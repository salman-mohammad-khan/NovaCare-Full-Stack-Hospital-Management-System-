// Does asking a follow-up question help? 20 deliberately vague first messages with a hidden true story.
//   AWS_BEARER_TOKEN_BEDROCK=... node server/benchmark/vague.mjs [--fresh]   (--fresh uses vague-fresh.json)
// Mode A: the assistant must answer the vague message at once (BEDROCK_ASK_FOLLOWUP=false).
// Mode B: it may ask, and a simulated patient (a second model) answers from the hidden story.
import { readFileSync } from "node:fs";
import { getTriageResponse } from "../triage.js";
import { seedDoctors } from "../seedData.js";
import { bedrockEnabled, converse } from "../bedrock.js";

if (!bedrockEnabled()) {
  console.error("Set AWS_BEARER_TOKEN_BEDROCK to run this benchmark.");
  process.exit(1);
}
const file = process.argv.includes("--fresh") ? "./vague-fresh.json" : "./vague.json";
const { cases } = JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const doctors = seedDoctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty, focusAreas: d.focusAreas, isAvailable: true }));
const pause = () => new Promise((resolve) => setTimeout(resolve, 700));

const PATIENT = "You role-play a patient chatting with a hospital assistant. Answer the assistant's questions truthfully in ONE short natural " +
  "message (at most 25 words) using only your real situation below. Use the same language style as your first message. Do not name a " +
  "specialty or a diagnosis.";

async function patientAnswer(item, assistantMessage) {
  const original = process.env.BEDROCK_MODEL_ID;
  process.env.BEDROCK_MODEL_ID = "google.gemma-3-27b-it";
  try {
    const reply = await converse({
      system: PATIENT,
      user: `Your first message: ${item.first}\nYour real situation: ${item.hidden}\nThe assistant said: ${assistantMessage}\nYour reply:`,
      maxTokens: 120,
    });
    return reply ? reply.replace(/^["']|["']$/g, "").trim() : null;
  } finally {
    if (original === undefined) delete process.env.BEDROCK_MODEL_ID;
    else process.env.BEDROCK_MODEL_ID = original;
  }
}

const ok = (item, rec) => Boolean(rec) && rec.specialty === item.specialty && rec.priority === item.priority;

async function run(label, allowQuestions) {
  process.env.BEDROCK_ASK_FOLLOWUP = allowQuestions ? "true" : "false";
  let right = 0;
  let asked = 0;
  const misses = [];
  for (const item of cases) {
    const messages = [{ role: "user", content: item.first }];
    let last = await getTriageResponse({ messages, doctors });
    await pause();
    if (last.recommendation?.tentative) {
      asked += 1;
      messages.push({ role: "assistant", content: last.message });
      const answer = await patientAnswer(item, last.message);
      if (answer) {
        messages.push({ role: "user", content: answer });
        last = await getTriageResponse({ messages, doctors });
        await pause();
      }
    }
    if (ok(item, last.recommendation)) right += 1;
    else misses.push(`   got ${last.recommendation?.specialty ?? "-"}/${last.recommendation?.priority ?? "-"}, expected ${item.specialty}/${item.priority} | "${item.first}"`);
  }
  console.log(`${label}: fully right ${right}/${cases.length}, asked questions in ${asked}/${cases.length}`);
  misses.forEach((line) => console.log(line));
}

await run("A. answer at once         ", false);
await run("B. may ask, patient replies", true);
