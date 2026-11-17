// Tests for the hosted-model part of the health assistant. No network: fetch is replaced in every test.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { converse, resetBedrockState } from "./bedrock.js";
import { cleanAdvice, parseSafety, parseTriage } from "./triageAi.js";
import { getTriageResponse } from "./triage.js";

const KEY = "test-key-123";
const SPECIALTIES = ["Cardiology", "General Medicine", "Pediatrics", "Psychiatry", "Gastroenterology"];
const DOCTORS = SPECIALTIES.map((specialty, index) => ({
  id: `dr-${index}`,
  name: `Dr. ${specialty}`,
  specialty,
  focusAreas: ["care"],
  isAvailable: true,
}));

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const ENV_KEYS = ["AWS_BEARER_TOKEN_BEDROCK", "BEDROCK_TRIAGE", "BEDROCK_MODEL_ID", "BEDROCK_MAY_DOWNGRADE", "BEDROCK_LOCAL_FALLBACK", "BEDROCK_ASK_FOLLOWUP", "LLM_ENABLED"];
let calls;
let warnings;

const reply = (text) => ({ ok: true, status: 200, json: async () => ({ output: { message: { content: [{ reasoningContent: {} }, { text }] } } }) });

/** Install a fake Bedrock: `answer(kind, body)` returns the model text for "triage" or "safety" calls. */
function fakeBedrock(answer) {
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const kind = body.system[0].text.startsWith("You are a safety classifier") ? "safety" : "triage";
    calls.push({ url: String(url), headers: options.headers, body, kind });
    const text = answer(kind, body);
    if (text instanceof Error) {
      throw text;
    }
    if (typeof text === "number") {
      return { ok: false, status: text, json: async () => ({}) };
    }
    return reply(text);
  };
}

const triageJson = (over = {}) =>
  JSON.stringify({ specialty: "Gastroenterology", urgency: "Routine", self_harm: false, reason: "stomach pain", symptoms: "stomach pain for 3 days", advice: "Rest and drink fluids, and get urgent help if the pain becomes severe.", ...over });
const safetyJson = (label) => JSON.stringify({ label });
const say = (text) => [{ role: "user", content: text }];

beforeEach(() => {
  calls = [];
  warnings = [];
  process.env.AWS_BEARER_TOKEN_BEDROCK = KEY;
  console.warn = (...args) => warnings.push(args.join(" "));
  resetBedrockState();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("bedrock client", () => {
  test("sends a Converse request with a bearer key and low reasoning effort for gpt-oss", async () => {
    fakeBedrock(() => "hello");
    assert.equal(await converse({ system: "S", user: "U", maxTokens: 50 }), "hello");
    const [call] = calls;
    assert.equal(call.url, "https://bedrock-runtime.ap-south-1.amazonaws.com/model/openai.gpt-oss-20b-1%3A0/converse");
    assert.equal(call.headers.Authorization, `Bearer ${KEY}`);
    assert.deepEqual(call.body.system, [{ text: "S" }]);
    assert.deepEqual(call.body.messages, [{ role: "user", content: [{ text: "U" }] }]);
    assert.equal(call.body.inferenceConfig.maxTokens, 50);
    assert.deepEqual(call.body.additionalModelRequestFields, { reasoning_effort: "low" });
  });

  test("no reasoning field for other models", async () => {
    process.env.BEDROCK_MODEL_ID = "google.gemma-3-27b-it";
    fakeBedrock(() => "hello");
    await converse({ system: "S", user: "U" });
    assert.equal(calls[0].body.additionalModelRequestFields, undefined);
  });

  test("a key with a BOM or newline is cleaned", async () => {
    process.env.AWS_BEARER_TOKEN_BEDROCK = `${String.fromCharCode(0xfeff)}${KEY}\r\n`;
    fakeBedrock(() => "ok");
    await converse({ system: "S", user: "U" });
    assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
  });

  test("one rate-limit answer (429) is retried once and then succeeds", async () => {
    const answers = [429, "ok"];
    fakeBedrock(() => answers.shift());
    assert.equal(await converse({ system: "S", user: "U" }), "ok");
    assert.equal(calls.length, 2);
    assert.equal(warnings.length, 0, "a retried 429 is not counted as a failure");
  });

  test("no key means no call", async () => {
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    fakeBedrock(() => "ok");
    assert.equal(await converse({ system: "S", user: "U" }), null);
    assert.equal(calls.length, 0);
  });

  test("an HTTP error or a thrown error gives null, and the key is never logged", async () => {
    fakeBedrock(() => 403);
    assert.equal(await converse({ system: "S", user: "U" }), null);
    fakeBedrock(() => new Error("network down"));
    assert.equal(await converse({ system: "S", user: "U" }), null);
    assert.ok(warnings.length >= 2);
    assert.ok(warnings.every((line) => !line.includes(KEY)));
  });

  test("three failures in a row pause Bedrock; one failure does not", async () => {
    fakeBedrock(() => 500);
    for (let i = 0; i < 3; i += 1) {
      await converse({ system: "S", user: "U" });
    }
    assert.equal(calls.length, 3);
    await converse({ system: "S", user: "U" });
    assert.equal(calls.length, 3, "paused: no network call");

    resetBedrockState();
    calls.length = 0;
    const answers = [500, "ok", 500, "ok"];
    fakeBedrock(() => answers.shift());
    for (let i = 0; i < 4; i += 1) {
      await converse({ system: "S", user: "U" });
    }
    assert.equal(calls.length, 4);
  });
});

describe("reading the model's answers", () => {
  test("parseTriage accepts a valid verdict and checks the specialty against the catalogue", () => {
    const parsed = parseTriage(triageJson({ specialty: "gastroenterology" }), SPECIALTIES);
    assert.equal(parsed.specialty, "Gastroenterology");
    assert.equal(parsed.urgency, "Routine");
    assert.equal(parsed.reason, "stomach pain");
  });

  test("a specialty the hospital does not have goes to General Medicine, None means no specialty", () => {
    assert.equal(parseTriage(triageJson({ specialty: "Ophthalmology" }), SPECIALTIES).specialty, "General Medicine");
    const none = parseTriage(triageJson({ specialty: "None", advice: "None" }), SPECIALTIES);
    assert.equal(none.specialty, null);
    assert.equal(none.advice, "");
  });

  test("unreadable or invalid answers give null", () => {
    assert.equal(parseTriage("no json here", SPECIALTIES), null);
    assert.equal(parseTriage(triageJson({ urgency: "Panic" }), SPECIALTIES), null);
    assert.equal(parseTriage("", SPECIALTIES), null);
  });

  test("code fences and chatter around the JSON are tolerated", () => {
    assert.equal(parseTriage(`\`\`\`json\n${triageJson()}\n\`\`\``, SPECIALTIES).urgency, "Routine");
    assert.equal(parseSafety('Sure: {"label": "emergency"}'), "EMERGENCY");
    assert.equal(parseSafety("self-harm"), "SELF_HARM");
    assert.equal(parseSafety("maybe"), null);
    assert.equal(parseSafety(null), null);
  });

  test("advice with a promise or a dose is dropped, long advice is cut to three sentences", () => {
    assert.equal(cleanAdvice("We have booked your appointment."), "");
    assert.equal(cleanAdvice("Take 500 mg twice a day."), "");
    assert.equal(cleanAdvice("None"), "");
    assert.equal(cleanAdvice("**Rest** well. Drink water. Eat light. Avoid spice."), "Rest well. Drink water. Eat light.");
  });
});

describe("the assistant with Bedrock on", () => {
  test("a normal message gets model advice, a doctor chosen by code, and a reason and symptoms for the booking form", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson()));
    const result = await getTriageResponse({ messages: say("I have stomach pain since 3 days"), doctors: DOCTORS });
    assert.equal(result.meta.route, "bedrock");
    assert.equal(result.recommendation.doctorName, "Dr. Gastroenterology");
    assert.equal(result.recommendation.priority, "Routine");
    assert.equal(result.recommendation.reasonForVisit, "stomach pain");
    assert.equal(result.recommendation.suggestedSymptoms, "stomach pain for 3 days");
    assert.match(result.message, /Rest and drink fluids/);
    assert.match(result.message, /Dr\. Gastroenterology/);
    assert.match(result.message, /not a medical diagnosis/);
    assert.equal(calls.length, 2);
  });

  test("an invented doctor is impossible: the catalogue decides", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ specialty: "Ophthalmology" })));
    const result = await getTriageResponse({ messages: say("my eyes are red and watering"), doctors: DOCTORS });
    assert.equal(result.recommendation.specialty, "General Medicine");
  });

  test("advice that promises a booking is replaced by the template", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ advice: "Your appointment is booked for tomorrow." })));
    const result = await getTriageResponse({ messages: say("I have stomach pain since 3 days"), doctors: DOCTORS });
    assert.doesNotMatch(result.message, /booked for tomorrow/);
    assert.match(result.message, /best fit/);
  });

  test("the safety check alone can raise an emergency the rules and triage miss", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("EMERGENCY") : triageJson({ specialty: "Pediatrics" })));
    const result = await getTriageResponse({ messages: say("he went quiet and his body looks wrong"), doctors: DOCTORS });
    assert.equal(result.meta.route, "emergency-model");
    assert.equal(result.recommendation.priority, "Emergency");
    assert.match(result.message, /108/);
    assert.doesNotMatch(result.message, /Rest and drink fluids/);
  });

  test("self-harm from the safety check gives Tele-MANAS and a psychiatry follow-up", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("SELF_HARM") : triageJson({ specialty: "General Medicine" })));
    const result = await getTriageResponse({ messages: say("nobody would notice if I was gone"), doctors: DOCTORS });
    assert.match(result.message, /14416/);
    assert.equal(result.recommendation.specialty, "Psychiatry");
  });

  test("the triage call can raise an emergency on its own", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ urgency: "Emergency", specialty: "Cardiology" })));
    const result = await getTriageResponse({ messages: say("my chest feels heavy and I am sweating a lot"), doctors: DOCTORS });
    assert.equal(result.recommendation.priority, "Emergency");
  });

  test("a rule's emergency stands even if both model calls say no", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ specialty: "Cardiology" })));
    const result = await getTriageResponse({ messages: say("I have crushing chest pain spreading to my left arm and I'm sweating a lot"), doctors: DOCTORS });
    assert.equal(result.meta.route, "emergency-rules");
    assert.equal(result.recommendation.priority, "Emergency");
  });

  test("BEDROCK_MAY_DOWNGRADE lets two clear 'no' answers cancel a rule alarm, never a self-harm one", async () => {
    process.env.BEDROCK_MAY_DOWNGRADE = "true";
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ specialty: "Cardiology" })));
    const info = await getTriageResponse({ messages: say("I have crushing chest pain spreading to my left arm and I'm sweating a lot"), doctors: DOCTORS });
    assert.notEqual(info.recommendation.priority, "Emergency");
    const harm = await getTriageResponse({ messages: say("I want to end my life"), doctors: DOCTORS });
    assert.match(harm.message, /14416/);
  });

  test("greetings and thanks never call the model", async () => {
    fakeBedrock(() => triageJson());
    const result = await getTriageResponse({ messages: say("thank you"), doctors: DOCTORS });
    assert.equal(calls.length, 0);
    assert.equal(result.recommendation, null);
  });

  test("a non-health question gets the small-talk reply and no doctor", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ specialty: "None", advice: "None" })));
    const result = await getTriageResponse({ messages: say("what are your clinic timings"), doctors: DOCTORS });
    assert.equal(result.recommendation, null);
  });

  test("when Bedrock is down the rules answer and the small local model is not used", async () => {
    fakeBedrock(() => new Error("down"));
    const urls = [];
    const down = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      urls.push(String(url));
      return down(url, options);
    };
    const result = await getTriageResponse({ messages: say("I have stomach pain since 3 days"), doctors: DOCTORS });
    assert.ok(result.recommendation, "the rules still recommend a doctor");
    assert.ok(urls.every((url) => url.includes("bedrock-runtime")), "no call to the local Ollama server");
  });

  test("without a key nothing changes: no Bedrock call", async () => {
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    process.env.LLM_ENABLED = "false";
    fakeBedrock(() => triageJson());
    const result = await getTriageResponse({ messages: say("I have stomach pain since 3 days"), doctors: DOCTORS });
    assert.equal(calls.length, 0);
    assert.equal(result.meta.route, "rules");
  });
});

describe("asking for a few more details", () => {
  const vague = (over = {}) =>
    triageJson({ area: "a stomach or digestion problem", ask: true, questions: ["How long has this been going on?", "Do you also have fever or vomiting?"], ...over });

  test("parseTriage keeps area, ask and at most two questions, and adds the question mark", () => {
    const parsed = parseTriage(vague({ questions: ["How long", "Any fever?", "Third one?"] }), SPECIALTIES);
    assert.equal(parsed.area, "a stomach or digestion problem");
    assert.equal(parsed.ask, true);
    assert.deepEqual(parsed.questions, ["How long?", "Any fever?"]);
  });

  test("ask without any question, or for a non-health message, does not count", () => {
    assert.equal(parseTriage(vague({ questions: [] }), SPECIALTIES).ask, false);
    assert.equal(parseTriage(vague({ specialty: "None" }), SPECIALTIES).ask, false);
  });

  test("a vague first message gets the likely area, a tentative specialist and the questions", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : vague()));
    const result = await getTriageResponse({ messages: say("my stomach hurts"), doctors: DOCTORS });
    assert.equal(result.meta.route, "bedrock-asking");
    assert.equal(result.recommendation.tentative, true);
    assert.equal(result.recommendation.doctorName, "Dr. Gastroenterology");
    assert.match(result.message, /this could be related to a stomach or digestion problem/);
    assert.match(result.message, /good starting point/);
    assert.match(result.message, /How long has this been going on\?/);
    assert.doesNotMatch(result.message, /I suggest booking/);
  });

  test("it asks only once: after an assistant question the answer is final", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : vague()));
    const messages = [
      { role: "user", content: "my stomach hurts" },
      { role: "assistant", content: "A few more details would help: How long has this been going on?" },
      { role: "user", content: "3 days, with vomiting" },
    ];
    const result = await getTriageResponse({ messages, doctors: DOCTORS });
    assert.equal(result.recommendation.tentative, false);
    assert.match(result.message, /I suggest booking/);
  });

  test("it stops asking once the patient has sent three messages", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : vague()));
    const messages = ["pain", "stomach", "since yesterday"].map((content) => ({ role: "user", content }));
    const result = await getTriageResponse({ messages, doctors: DOCTORS });
    assert.equal(result.recommendation.tentative, false);
  });

  test("an emergency never waits for questions", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("EMERGENCY") : vague()));
    const result = await getTriageResponse({ messages: say("he went quiet and his body looks wrong"), doctors: DOCTORS });
    assert.equal(result.recommendation.priority, "Emergency");
    assert.doesNotMatch(result.message, /a few more details/);
  });

  test("BEDROCK_ASK_FOLLOWUP=false turns the questions off", async () => {
    process.env.BEDROCK_ASK_FOLLOWUP = "false";
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : vague()));
    const result = await getTriageResponse({ messages: say("my stomach hurts"), doctors: DOCTORS });
    assert.equal(result.recommendation.tentative, false);
    assert.match(result.message, /I suggest booking/);
  });

  test("a message that already says how long is not asked again", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : vague()));
    const result = await getTriageResponse({ messages: say("my stomach hurts since 3 days"), doctors: DOCTORS });
    assert.equal(result.recommendation.tentative, false);
    assert.doesNotMatch(result.message, /a few more details/);
  });

  test("a clear message gets the area line and the advice in the normal reply", async () => {
    fakeBedrock((kind) => (kind === "safety" ? safetyJson("NONE") : triageJson({ area: "a stomach or digestion problem" })));
    const result = await getTriageResponse({ messages: say("I have stomach pain since 3 days, no fever"), doctors: DOCTORS });
    assert.equal(result.recommendation.tentative, false);
    assert.match(result.message, /this could be related to a stomach or digestion problem\. Rest and drink fluids/);
  });
});
