// NovaCare health assistant. Rules decide emergencies first. When a Bedrock key is set, a hosted model (gpt-oss 20B)
// picks the specialty, urgency and short advice and a second model call checks for emergencies and self-harm; the doctor
// is always chosen here, in code. Without a key (or when Bedrock is down) the rules and a small local model (Ollama)
// answer as before.
import { decide } from "./triageRules.js";
import { bedrockConfig, bedrockEnabled } from "./bedrock.js";
import { GENERAL, PROMISES, safetyCheck, triageWithBedrock } from "./triageAi.js";

// With Bedrock on, the small local model is only a fallback when BEDROCK_LOCAL_FALLBACK=true: after a Bedrock failure the
// rules and templates answer instead, because a 2B model gave wrong specialties in testing.
const localModelAllowed = () =>
  process.env.LLM_ENABLED !== "false" && (!bedrockEnabled() || process.env.BEDROCK_LOCAL_FALLBACK === "true");

const llmConfig = () => ({
  enabled: localModelAllowed(),
  baseUrl: process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434",
  model: process.env.LOCAL_LLM_MODEL ?? "qwen3.5:2b",
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30000),
  // A 2B model tends to promise things ("we have scheduled...") so replies are templates unless this is switched on.
  modelReplies: process.env.LLM_REPLY === "true",
});

const MAX_CONTEXT_MESSAGES = 3;
const MAX_CONTEXT_CHARS = 600;
const REPLY_TOKEN_CAP = 90;
const DISCLAIMER = "This is general guidance, not a medical diagnosis.";

// ── only one model call at a time (the VM has two CPU cores); a short queue, then templates ──
let running = 0;
const waiting = [];
const MAX_WAITING = 2;

async function withLlmSlot(task) {
  if (running >= 1) {
    if (waiting.length >= MAX_WAITING) {
      return null;
    }
    await new Promise((resolve) => waiting.push(resolve));
  } else {
    running += 1;
  }

  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) {
      next();
    } else {
      running -= 1;
    }
  }
}

async function ollamaChat({ system, user, format, numPredict, temperature = 0 }) {
  const config = llmConfig();
  const body = {
    model: config.model,
    stream: false,
    keep_alive: -1,
    options: { temperature, num_predict: numPredict, num_ctx: 4096 },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (config.model.startsWith("qwen")) {
    body.think = false;
  }
  if (format) {
    body.format = format;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    let response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 400 && body.think === false) {
      delete body.think;
      response = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return { text: String(data?.message?.content ?? ""), cut: data?.done_reason === "length" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── prompts (the same lean prompts that were benchmarked) ──
function buildClassifierPrompt(doctors) {
  const lines = [
    "You route patient messages for a hospital. Choose the single best specialty for the patient's main problem.",
    "Specialties (with what each one covers):",
  ];
  for (const doctor of doctors) {
    lines.push(`- ${doctor.specialty}: ${(doctor.focusAreas ?? []).join(", ")}`);
  }
  lines.push(
    "Rules: a child (under 13) goes to Pediatrics. Use General Medicine for fever, tiredness or unclear problems.",
    "If the message is not about a health problem (greeting, booking question), use None.",
    "urgency: Emergency only if life-threatening right now (chest pain with sweating, stroke signs, cannot breathe, heavy bleeding, unconscious, seizure, severe allergic reaction, poisoning, thoughts of suicide, newborn fever). Urgent if needs a doctor within a day or two (high fever for days, blood in urine). Otherwise Routine.",
    'Answer only with JSON: {"specialty": "...", "urgency": "..."}',
  );
  return lines.join("\n");
}

const REPLY_PROMPT =
  "You are NovaCare's patient assistant. The system has already decided the next step. Write a short, kind reply of at most 3 sentences. " +
  "Recommend the doctor given and follow the priority: if the priority is Urgent, advise booking the earliest slot; if Routine, advise booking an appointment. " +
  "Only repeat symptoms the patient actually wrote. Nothing has been booked: never say an appointment is scheduled, booked or confirmed. Do not diagnose and do not change the doctor.";

async function classifyWithLlm(text, doctors) {
  const specialties = [...new Set(doctors.map((doctor) => doctor.specialty))];
  const result = await ollamaChat({
    system: buildClassifierPrompt(doctors),
    user: text,
    numPredict: 60,
    format: {
      type: "object",
      properties: {
        specialty: { type: "string", enum: [...specialties, "None"] },
        urgency: { type: "string", enum: ["Routine", "Urgent", "Emergency"] },
      },
      required: ["specialty", "urgency"],
    },
  });

  if (!result) {
    return null;
  }

  try {
    const parsed = JSON.parse(result.text);
    if (![...specialties, "None"].includes(parsed.specialty) || !["Routine", "Urgent", "Emergency"].includes(parsed.urgency)) {
      return null;
    }
    return { specialty: parsed.specialty === "None" ? null : parsed.specialty, urgency: parsed.urgency };
  } catch {
    return null;
  }
}

function cleanReply(result) {
  let text = result.text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/\s+/g, " ").trim();
  if (result.cut) {
    const lastEnd = Math.max(text.lastIndexOf("."), text.lastIndexOf("!"), text.lastIndexOf("?"));
    text = lastEnd > 20 ? text.slice(0, lastEnd + 1) : "";
  }
  return text;
}

async function writeReplyWithLlm({ latest, doctor, priority }) {
  const result = await ollamaChat({
    system: REPLY_PROMPT,
    user: `Patient message: ${latest}\nDecision: doctor ${doctor.name} (${doctor.specialty}), priority ${priority}.`,
    numPredict: REPLY_TOKEN_CAP,
    temperature: 0.3,
  });
  const reply = result ? cleanReply(result) : "";
  return reply && reply.includes(doctor.name) && !PROMISES.test(reply) ? reply : "";
}

/** Load the model into memory at startup so the first patient does not wait for a cold start. */
export async function warmUpModel() {
  if (!localModelAllowed()) {
    return false;
  }
  const result = await ollamaChat({ system: "Reply with one word.", user: "ping", numPredict: 2 });
  return Boolean(result);
}

// ── templates (used for emergencies, small talk, and whenever the model is unavailable) ──
function emergencyReply({ selfHarm, doctor }) {
  const parts = [
    "This could be an emergency. Please call 108 (or 112) right now or go to the nearest emergency room. Do not wait for an appointment.",
  ];
  if (selfHarm) {
    parts.push(
      "You are not alone. You can also call Tele-MANAS on 14416 or 1800-891-4416 (free, 24x7) to talk to a trained counsellor.",
    );
  }
  if (doctor) {
    parts.push(`Once you are safe, ${doctor.name} (${doctor.specialty}) can follow up with you.`);
  }
  return parts.join(" ");
}

function joinList(items) {
  if (items.length <= 1) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function fallbackReply({ doctor, priority }) {
  const focus = (doctor.focusAreas ?? []).slice(0, 3).map((item) => (/^[A-Z]{2,}(\s|$)/.test(String(item)) ? String(item) : String(item).toLowerCase()));
  const covers = focus.length ? `, who covers ${joinList(focus)},` : "";
  const intro = priority === "Urgent" ? "Thanks for explaining. This should be looked at soon." : "Thanks for explaining.";
  const next = priority === "Urgent" ? "Please book the earliest available slot." : "You can book an appointment below.";
  return `${intro} ${doctor.name} (${doctor.specialty})${covers} looks like the best fit. ${next}`;
}

function smallTalkReply(text) {
  if (/book|appointment|timing|hours/.test(text.toLowerCase())) {
    return "To book, open Find specialists, choose a doctor, pick a date and time slot, and send the request. You need to be signed in as a patient. Tell me your symptoms if you would like help choosing a specialist.";
  }
  return "Hi! I'm NovaCare's health assistant. Tell me what symptoms or concerns you have and I'll help you find the right specialist.";
}

// ── helpers ──
function pickDoctor(doctors, specialty) {
  const available = doctors.filter((doctor) => doctor.isAvailable !== false);
  return (
    available.find((doctor) => doctor.specialty === specialty) ??
    available.find((doctor) => doctor.specialty === GENERAL) ??
    available[0] ??
    null
  );
}

function trimTo(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function buildRecommendation({ doctor, priority, firstUser, latest, ai, tentative = false }) {
  const teleFriendly = ["Psychiatry", "Endocrinology"].includes(doctor.specialty);
  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialty: doctor.specialty,
    consultMode: priority === "Routine" && teleFriendly ? "Tele-consult" : "In-clinic",
    priority,
    reasonForVisit: trimTo(ai?.reason || firstUser || latest, 80),
    suggestedSymptoms: trimTo(ai?.symptoms || latest, 300),
    // true while the assistant is still asking for details, so the widget can say the specialist may change
    tentative,
  };
}

const TRIVIAL = /^(hi|hii|hello|hey|namaste|thanks|thank you|thankyou|ok|okay|bye)\W*$/i;

// A message that already says how long it has lasted is not asked "how long?" again, even if the model wants to.
const STATES_DURATION =
  /(\d+\s*(days?|weeks?|months?|years?|hours?|din|hafte|hafta|mahine|mahina|saal|ghante)|\bsince\b|for the (last|past)|\bkal se\b|\bfrom yesterday\b|last night|this morning|\btoday\b|\ba week\b|\ba month\b|\btwo days\b|\bthree days\b)/i;
const statesDuration = (text) => STATES_DURATION.test(text) && text.trim().split(/\s+/).length >= 4;

// The hosted-model path. Returns null when Bedrock is off, down or unreadable, so the rules and local model run instead.
async function bedrockPath({ messages, doctors, rules, userMessages, latest, meta, done }) {
  if (!bedrockEnabled() || latest.trim().length < 4 || TRIVIAL.test(latest.trim())) {
    return null;
  }
  const turns = userMessages.slice(-MAX_CONTEXT_MESSAGES).map((turn) => turn.slice(0, MAX_CONTEXT_CHARS));
  const [triage, safety] = await Promise.all([triageWithBedrock(turns, doctors), safetyCheck([latest])]);
  if (!triage && !safety) {
    return null;
  }
  meta.route = "bedrock";
  meta.llmCalls = 2;
  meta.model = bedrockConfig().model;

  const selfHarm = rules.selfHarm || triage?.selfHarm === true || safety === "SELF_HARM";
  let emergency = rules.emergency || triage?.urgency === "Emergency" || safety === "EMERGENCY" || selfHarm;
  // Optional (off by default): when both model calls clearly say "not an emergency", let them cancel a rule's alarm. The rules
  // have known false alarms ("how to avoid food poisoning"), but a rule firing is the safer default.
  if (emergency && rules.emergency && !selfHarm && process.env.BEDROCK_MAY_DOWNGRADE === "true"
      && triage && triage.urgency !== "Emergency" && safety === "NONE") {
    emergency = false;
  }

  if (emergency) {
    meta.route = rules.emergency ? "emergency-rules" : "emergency-model";
    const doctor = pickDoctor(doctors, selfHarm ? "Psychiatry" : triage?.specialty ?? rules.specialty);
    const recommendation = doctor
      ? buildRecommendation({ doctor, priority: "Emergency", firstUser: userMessages[0], latest, ai: triage })
      : null;
    return done(emergencyReply({ selfHarm, doctor }), recommendation);
  }

  // the triage call failed but the safety check answered: no alarm was raised, so let the rules and templates answer
  if (!triage) {
    meta.llmCalls = 0;
    meta.route = "";
    return null;
  }

  // the model says this is not about the patient's health (timings, fees, thanks): no doctor, even if a keyword looked medical
  if (triage.specialty === null) {
    meta.route = "small-talk";
    return done(smallTalkReply(latest), null);
  }

  const specialty = triage?.specialty ?? rules.specialty;
  const priority = triage?.urgency === "Urgent" || rules.priority === "Urgent" ? "Urgent" : "Routine";
  const doctor = pickDoctor(doctors, specialty);
  if (!doctor) {
    meta.route = "no-doctor";
    return done("I could not find an available doctor right now. Please try again later or contact the clinic from the Contact page.", null);
  }
  // Ask for a few more details once, and only when the model says they would change the recommendation. The doctor is still
  // shown, marked as tentative. After one round of questions (or a long chat) the assistant always gives its answer.
  const alreadyAsked = messages.some((message) => message.role === "assistant" && String(message.content).includes("?"));
  const asking = process.env.BEDROCK_ASK_FOLLOWUP !== "false" && triage.ask && !alreadyAsked && userMessages.length < 3 && !statesDuration(latest);
  const recommendation = buildRecommendation({ doctor, priority, firstUser: userMessages[0], latest, ai: triage, tentative: asking });
  const pointer = triage.area ? `From what you've told me, this could be related to ${triage.area}. ` : "";
  if (asking) {
    meta.route = "bedrock-asking";
    return done(
      `${pointer}${doctor.name} (${doctor.specialty}) looks like a good starting point, but a few more details would help me be sure: ${triage.questions.join(" ")} ${DISCLAIMER}`,
      recommendation,
    );
  }
  const reply = triage?.advice
    ? `${pointer}${triage.advice} ${priority === "Urgent" ? "I suggest booking the earliest slot with" : "I suggest booking an appointment with"} ${doctor.name} (${doctor.specialty}).`
    : fallbackReply({ doctor, priority });
  return done(`${reply} ${DISCLAIMER}`, recommendation);
}

/**
 * messages: [{ role, content }] (the chat so far, last one is the patient's newest message)
 * doctors:  catalogue rows [{ id, name, specialty, focusAreas, isAvailable }]
 * returns { message, recommendation | null, meta }
 */
export async function getTriageResponse({ messages, doctors }) {
  const started = Date.now();
  const userMessages = messages.filter((message) => message.role === "user").map((message) => String(message.content));
  const latest = userMessages.at(-1) ?? "";
  const context = userMessages.slice(-MAX_CONTEXT_MESSAGES).join(". ").slice(-MAX_CONTEXT_CHARS);
  const rules = decide(context);
  const meta = { route: "", llmCalls: 0, model: llmConfig().model };
  const done = (message, recommendation) => ({ message, recommendation, meta: { ...meta, ms: Date.now() - started } });

  // 0) hosted model first when a Bedrock key is set; null means it is off or down, so the steps below run
  const viaBedrock = await bedrockPath({ messages, doctors, rules, userMessages, latest, meta, done });
  if (viaBedrock) {
    return viaBedrock;
  }

  // 1) not a health question: greet or explain booking, no model needed
  if (!rules.medical || (!rules.emergency && rules.score === 0 && latest.trim().length < 4)) {
    meta.route = "small-talk";
    return done(smallTalkReply(latest), null);
  }

  // 2) emergency: fixed safety message first, never waits for a model
  if (rules.emergency) {
    meta.route = "emergency-rules";
    const doctor = pickDoctor(doctors, rules.specialty);
    const recommendation = doctor ? buildRecommendation({ doctor, priority: "Emergency", firstUser: userMessages[0], latest }) : null;
    return done(emergencyReply({ selfHarm: rules.selfHarm, doctor }), recommendation);
  }

  // 3) decide the specialty: rules when confident, otherwise ask the small model
  let specialty = rules.specialty;
  let priority = rules.priority;
  const config = llmConfig();
  meta.route = "rules";

  if (!rules.confident && config.enabled) {
    const verdict = await withLlmSlot(() => classifyWithLlm(context, doctors));
    meta.llmCalls += 1;
    if (verdict) {
      meta.route = "rules+llm";
      if (verdict.urgency === "Emergency") {
        const doctor = pickDoctor(doctors, verdict.specialty ?? specialty);
        meta.route = "emergency-llm";
        const recommendation = doctor ? buildRecommendation({ doctor, priority: "Emergency", firstUser: userMessages[0], latest }) : null;
        return done(emergencyReply({ selfHarm: false, doctor }), recommendation);
      }
      if (verdict.specialty) {
        specialty = verdict.specialty;
      }
      if (verdict.urgency === "Urgent") {
        priority = "Urgent";
      }
    }
  }

  const doctor = pickDoctor(doctors, specialty);
  if (!doctor) {
    meta.route = "no-doctor";
    return done("I could not find an available doctor right now. Please try again later or contact the clinic from the Contact page.", null);
  }

  // 4) short reply: model-written when available, template otherwise
  let reply = "";
  if (config.enabled && config.modelReplies) {
    reply = (await withLlmSlot(() => writeReplyWithLlm({ latest, doctor, priority }))) ?? "";
    meta.llmCalls += 1;
  }
  if (!reply) {
    reply = fallbackReply({ doctor, priority });
  }

  const recommendation = buildRecommendation({ doctor, priority, firstUser: userMessages[0], latest });
  return done(`${reply} ${DISCLAIMER}`, recommendation);
}
