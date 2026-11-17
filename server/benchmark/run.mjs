// Measures the health assistant on labelled messages: `npm run bench` (rules only, no key needed) or with a Bedrock key
// in the environment (rules plus the hosted model). Prints how often specialty and priority are both right.
//   AWS_BEARER_TOKEN_BEDROCK=... node server/benchmark/run.mjs [--set audit|fresh] [--verbose] [--simulate]
//
// --simulate: when the assistant asks follow-up questions, a second model plays the patient and answers them (it is told the
// labelled specialty, so its answers are consistent with it), then the assistant answers again. This approximates a real
// conversation; it is not a substitute for real patients.
import { readFileSync } from "node:fs";
import { getTriageResponse } from "../triage.js";
import { seedDoctors } from "../seedData.js";
import { bedrockEnabled, converse } from "../bedrock.js";

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const only = process.argv.includes("--set") ? process.argv[process.argv.indexOf("--set") + 1] : null;
const verbose = process.argv.includes("--verbose");
const simulate = process.argv.includes("--simulate");
const doctors = seedDoctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty, focusAreas: d.focusAreas, isAvailable: true }));
if (!bedrockEnabled()) {
  process.env.LLM_ENABLED = "false"; // rules only: do not wait for a local model
}
const mode = bedrockEnabled() ? "rules + hosted model" : "rules only";
const pause = () => (bedrockEnabled() ? new Promise((resolve) => setTimeout(resolve, 700)) : null); // stay under the request limit

const PATIENT = "You role-play a patient chatting with a hospital assistant. Reply with ONE short natural message (at most 25 words) " +
  "that answers the assistant's questions with plausible details (how long, related symptoms), consistent with your underlying " +
  "problem. Use the same language style as your first message (English, Hindi or Hinglish). Do not name a specialty or a diagnosis.";

async function patientAnswer(item, firstMessage, assistantMessage) {
  const original = process.env.BEDROCK_MODEL_ID;
  process.env.BEDROCK_MODEL_ID = "google.gemma-3-27b-it"; // a different model from the assistant's
  try {
    const reply = await converse({
      system: PATIENT,
      user: `Your first message: ${firstMessage}\nYour underlying problem fits the specialty ${item.specialty} (priority ${item.priority}).\nThe assistant said: ${assistantMessage}\nYour reply:`,
      maxTokens: 120,
    });
    return reply ? reply.replace(/^["']|["']$/g, "").trim() : null;
  } finally {
    if (original === undefined) delete process.env.BEDROCK_MODEL_ID;
    else process.env.BEDROCK_MODEL_ID = original;
  }
}

const isRight = (item, rec) => {
  const specialty = rec ? rec.specialty : "-";
  const priority = rec ? rec.priority : "-";
  return { specialtyOk: item.specialty === "*" || item.specialty === specialty, priorityOk: item.priority === priority, specialty, priority };
};

const totals = {};
for (const item of cases.filter((c) => !only || c.set === only)) {
  const messages = [];
  let last;
  for (const turn of item.turns) {
    messages.push({ role: "user", content: turn });
    last = await getTriageResponse({ messages, doctors });
    messages.push({ role: "assistant", content: last.message });
    await pause();
  }
  const first = isRight(item, last.recommendation);
  const asked = Boolean(last.recommendation?.tentative);
  let final = first;
  let answer = null;
  if (asked && simulate) {
    answer = await patientAnswer(item, item.turns[0], last.message);
    if (answer) {
      messages.push({ role: "user", content: answer });
      last = await getTriageResponse({ messages, doctors });
      final = isRight(item, last.recommendation);
      await pause();
    }
  }
  const bucket = (totals[item.set] ??= { n: 0, ok: 0, specialty: 0, priority: 0, emergencies: 0, emergenciesCaught: 0, asked: 0, askedFirstOk: 0, askedFinalOk: 0 });
  bucket.n += 1;
  bucket.specialty += final.specialtyOk;
  bucket.priority += final.priorityOk;
  bucket.ok += final.specialtyOk && final.priorityOk;
  if (item.priority === "Emergency") {
    bucket.emergencies += 1;
    bucket.emergenciesCaught += final.priority === "Emergency";
  }
  if (asked) {
    bucket.asked += 1;
    bucket.askedFirstOk += first.specialtyOk && first.priorityOk;
    bucket.askedFinalOk += final.specialtyOk && final.priorityOk;
  }
  const ok = final.specialtyOk && final.priorityOk;
  if (!ok || verbose || asked) {
    const tag = asked ? "ASK " : ok ? "ok  " : "MISS";
    const extra = asked ? ` | first ${first.specialty}/${first.priority}${answer ? ` -> after "${answer.slice(0, 50)}" ${final.specialty}/${final.priority}` : ""}` : "";
    console.log(`${ok ? tag : `${tag}${asked ? "" : ""}`} [${item.set}] expected ${item.specialty}/${item.priority}, got ${final.specialty}/${final.priority}${extra} | ${item.turns.at(-1).slice(0, 60)}`);
  }
}
console.log(`\nMode: ${mode}${simulate ? " + follow-up questions answered by a simulated patient" : ""}`);
for (const [name, b] of Object.entries(totals)) {
  console.log(`${name}: fully right ${b.ok}/${b.n} | specialty ${b.specialty}/${b.n} | priority ${b.priority}/${b.n} | emergencies called Emergency ${b.emergenciesCaught}/${b.emergencies} | asked questions ${b.asked}/${b.n} (right before the answer ${b.askedFirstOk}, after ${b.askedFinalOk})`);
}
