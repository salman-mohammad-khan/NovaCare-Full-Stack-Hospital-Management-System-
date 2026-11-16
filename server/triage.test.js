import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { getTriageResponse } from "./triage.js";
import { decide } from "./triageRules.js";

const DOCTORS = [
  ["dr-aisha-rahman", "Dr. Aisha Rahman", "Cardiology"],
  ["dr-karan-sood", "Dr. Karan Sood", "Neurology"],
  ["dr-meera-joseph", "Dr. Meera Joseph", "Pediatrics"],
  ["dr-rohan-iyer", "Dr. Rohan Iyer", "Orthopedics"],
  ["dr-sana-qureshi", "Dr. Sana Qureshi", "Dermatology"],
  ["dr-dev-malhotra", "Dr. Dev Malhotra", "General Medicine"],
  ["dr-priya-nair", "Dr. Priya Nair", "Gynecology"],
  ["dr-harsh-bedi", "Dr. Harsh Bedi", "Gastroenterology"],
  ["dr-farah-siddiqui", "Dr. Farah Siddiqui", "Pulmonology"],
  ["dr-nandini-rao", "Dr. Nandini Rao", "Psychiatry"],
  ["dr-vikram-khanna", "Dr. Vikram Khanna", "ENT"],
  ["dr-isha-kapoor", "Dr. Isha Kapoor", "Endocrinology"],
  ["dr-kabir-ali", "Dr. Kabir Ali", "Nephrology"],
].map(([id, name, specialty]) => ({ id, name, specialty, focusAreas: ["care"], isAvailable: true }));

const say = (text) => [{ role: "user", content: text }];

describe("rules", () => {
  const emergencies = [
    "I have crushing chest pain spreading to my left arm for 20 minutes and I'm sweating a lot.",
    "My father suddenly can't speak properly and one side of his face is drooping.",
    "I can't breathe properly and my lips are turning blue",
    "my mother fainted and is not responding to us",
    "I want to end my life",
    "I cut my hand badly and the bleeding won't stop",
    "my face swelled up after eating prawns and my throat feels tight",
    "my toddler swallowed some of my tablets",
    "sudden severe headache, the worst headache of my life",
    "my newborn, 10 days old, has a fever",
  ];
  for (const text of emergencies) {
    test(`emergency: ${text.slice(0, 40)}`, () => assert.equal(decide(text).priority, "Emergency"));
  }

  test("routine complaints are not emergencies", () => {
    for (const text of [
      "I've had wheezing and shortness of breath at night for a month",
      "My knee has been painful and swollen for a week after running",
      "I get acid reflux and burning stomach pain after meals for two weeks",
    ]) {
      assert.equal(decide(text).emergency, false, text);
    }
  });

  test("a negation at the very end of the message still counts", () => {
    assert.equal(decide("I have an itchy red rash on both arms for 4 days, no fever").priority, "Routine");
  });

  test("negated fever does not make a case urgent", () => {
    assert.equal(decide("itchy red rash on both arms for 4 days, no fever, no other symptoms").priority, "Routine");
    assert.equal(decide("I have had a fever of 103 for 4 days with body ache").priority, "Urgent");
  });

  test("children go to pediatrics, Hinglish works", () => {
    assert.equal(decide("My 3-year-old son has a mild cough and runny nose").specialty, "Pediatrics");
    assert.equal(decide("mere bete ko 5 saal ka hai usko khansi aur bukhar hai").specialty, "Pediatrics");
    assert.equal(decide("mujhe 3 din se bukhar hai aur badan dard bhi hai").specialty, "General Medicine");
  });

  test("greetings and booking questions are not medical", () => {
    assert.equal(decide("hello").medical, false);
    assert.equal(decide("How do I book an appointment?").medical, false);
  });

  test("tied keywords are not confident, so the model can decide", () => {
    assert.equal(decide("I don't feel well").confident, false);
  });
});

describe("assistant without a model", () => {
  beforeEach(() => {
    process.env.LLM_ENABLED = "false";
  });
  afterEach(() => {
    delete process.env.LLM_ENABLED;
  });

  test("emergency answers instantly with 108 and a doctor card", async () => {
    const result = await getTriageResponse({ messages: say("crushing chest pain spreading to my left arm and sweating"), doctors: DOCTORS });
    assert.match(result.message, /108/);
    assert.equal(result.recommendation.priority, "Emergency");
    assert.equal(result.recommendation.specialty, "Cardiology");
    assert.equal(result.meta.llmCalls, 0);
  });

  test("suicidal message adds Tele-MANAS", async () => {
    const result = await getTriageResponse({ messages: say("I want to end my life"), doctors: DOCTORS });
    assert.match(result.message, /14416/);
    assert.match(result.message, /108/);
  });

  test("greeting gets no recommendation", async () => {
    const result = await getTriageResponse({ messages: say("hello"), doctors: DOCTORS });
    assert.equal(result.recommendation, null);
    assert.equal(result.meta.route, "small-talk");
  });

  test("routine case recommends the matching doctor with the booking form values", async () => {
    const result = await getTriageResponse({
      messages: say("Pimples on my face and back for 2 months and my skin is very oily"),
      doctors: DOCTORS,
    });
    assert.equal(result.recommendation.doctorId, "dr-sana-qureshi");
    assert.equal(result.recommendation.priority, "Routine");
    assert.equal(result.recommendation.consultMode, "In-clinic");
    assert.match(result.message, /not a medical diagnosis/);
  });

  test("an unavailable doctor falls back to General Medicine", async () => {
    const doctors = DOCTORS.map((doctor) => (doctor.specialty === "Dermatology" ? { ...doctor, isAvailable: false } : doctor));
    const result = await getTriageResponse({ messages: say("itchy rash and pimples on my skin"), doctors });
    assert.equal(result.recommendation.doctorId, "dr-dev-malhotra");
  });

  test("no available doctor gives a message and no card", async () => {
    const doctors = DOCTORS.map((doctor) => ({ ...doctor, isAvailable: false }));
    const result = await getTriageResponse({ messages: say("itchy rash on my skin"), doctors });
    assert.equal(result.recommendation, null);
  });
});

describe("assistant with a model", () => {
  const realFetch = globalThis.fetch;
  let calls;

  const mockOllama = (handler) => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      const out = handler(body);
      if (out instanceof Error) {
        throw out;
      }
      return { ok: true, status: 200, json: async () => ({ message: { content: out }, done_reason: "stop" }) };
    };
  };

  beforeEach(() => {
    process.env.LLM_ENABLED = "true";
    delete process.env.LLM_REPLY;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.LLM_ENABLED;
    delete process.env.LLM_REPLY;
  });

  test("confident rules decide instantly without calling the model", async () => {
    mockOllama(() => "should not be used");
    const result = await getTriageResponse({ messages: say("Pimples on my face and back for 2 months, very oily skin"), doctors: DOCTORS });
    assert.equal(calls.length, 0);
    assert.equal(result.meta.llmCalls, 0);
    assert.equal(result.recommendation.doctorId, "dr-sana-qureshi");
    assert.match(result.message, /Dr\. Sana Qureshi/);
  });

  test("unsure rules ask the constrained classifier once", async () => {
    mockOllama(() => JSON.stringify({ specialty: "General Medicine", urgency: "Routine" }));
    const result = await getTriageResponse({ messages: say("I don't feel well"), doctors: DOCTORS });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].body.format, "the classifier call uses a JSON schema");
    assert.equal(calls[0].body.keep_alive, -1);
    assert.equal(result.meta.route, "rules+llm");
    assert.equal(result.recommendation.doctorId, "dr-dev-malhotra");
  });

  test("the classifier can pick a specialty the rules could not", async () => {
    mockOllama(() => JSON.stringify({ specialty: "Nephrology", urgency: "Routine" }));
    const result = await getTriageResponse({ messages: say("My ankles are puffy and my urine looks odd lately"), doctors: DOCTORS });
    assert.equal(result.recommendation.specialty, "Nephrology");
  });

  test("an emergency verdict from the model becomes the emergency message", async () => {
    mockOllama(() => JSON.stringify({ specialty: "Neurology", urgency: "Emergency" }));
    const result = await getTriageResponse({ messages: say("I don't feel well"), doctors: DOCTORS });
    assert.match(result.message, /108/);
    assert.equal(result.recommendation.priority, "Emergency");
    assert.equal(result.meta.route, "emergency-llm");
  });

  test("model failure on an unsure case falls back to the rules", async () => {
    mockOllama(() => new Error("connection refused"));
    const result = await getTriageResponse({ messages: say("I don't feel well"), doctors: DOCTORS });
    assert.equal(result.recommendation.specialty, "General Medicine");
    assert.match(result.message, /Dr\. Dev Malhotra/);
  });

  test("an invalid classifier answer is ignored", async () => {
    mockOllama(() => "not json");
    const result = await getTriageResponse({ messages: say("I don't feel well"), doctors: DOCTORS });
    assert.equal(result.recommendation.specialty, "General Medicine");
  });

  test("optional model replies are used only when they name the doctor and promise nothing", async () => {
    process.env.LLM_REPLY = "true";
    mockOllama(() => "A skin specialist, Dr. Sana Qureshi, is the right fit. Please book an appointment.");
    let result = await getTriageResponse({ messages: say("itchy rash and pimples on my skin"), doctors: DOCTORS });
    assert.equal(calls.length, 1);
    assert.match(result.message, /skin specialist/);

    mockOllama(() => "We have scheduled an appointment with Dr. Sana Qureshi for you.");
    result = await getTriageResponse({ messages: say("itchy rash and pimples on my skin"), doctors: DOCTORS });
    assert.doesNotMatch(result.message, /scheduled/);
    assert.match(result.message, /Dr\. Sana Qureshi/);
  });
});
