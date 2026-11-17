// Measures the health assistant on labelled messages: `npm run bench` (rules only, no key needed) or with a Bedrock key
// in the environment (rules plus the hosted model). Prints how often specialty and priority are both right.
//   AWS_BEARER_TOKEN_BEDROCK=... node server/benchmark/run.mjs [--set audit|fresh] [--verbose]
import { readFileSync } from "node:fs";
import { getTriageResponse } from "../triage.js";
import { seedDoctors } from "../seedData.js";
import { bedrockEnabled } from "../bedrock.js";

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const only = process.argv.includes("--set") ? process.argv[process.argv.indexOf("--set") + 1] : null;
const verbose = process.argv.includes("--verbose");
const doctors = seedDoctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty, focusAreas: d.focusAreas, isAvailable: true }));
if (!bedrockEnabled()) {
  process.env.LLM_ENABLED = "false"; // rules only: do not wait for a local model
}
const mode = bedrockEnabled() ? "rules + hosted model" : "rules only";

const totals = {};
let shown = 0;
for (const item of cases.filter((c) => !only || c.set === only)) {
  const messages = [];
  let last;
  for (const turn of item.turns) {
    messages.push({ role: "user", content: turn });
    last = await getTriageResponse({ messages, doctors });
    messages.push({ role: "assistant", content: last.message });
    if (bedrockEnabled()) await new Promise((resolve) => setTimeout(resolve, 700)); // stay under the model's request limit
  }
  const rec = last.recommendation;
  const gotSpecialty = rec ? rec.specialty : "-";
  const gotPriority = rec ? rec.priority : "-";
  const specialtyOk = item.specialty === "*" || item.specialty === gotSpecialty;
  const priorityOk = item.priority === gotPriority;
  const bucket = (totals[item.set] ??= { n: 0, ok: 0, specialty: 0, priority: 0, emergencies: 0, emergenciesCaught: 0 });
  bucket.n += 1;
  bucket.specialty += specialtyOk;
  bucket.priority += priorityOk;
  bucket.ok += specialtyOk && priorityOk;
  if (item.priority === "Emergency") {
    bucket.emergencies += 1;
    bucket.emergenciesCaught += gotPriority === "Emergency";
  }
  if (!(specialtyOk && priorityOk) || verbose) {
    shown += 1;
    console.log(`${specialtyOk && priorityOk ? "ok  " : "MISS"} [${item.set}] expected ${item.specialty}/${item.priority}, got ${gotSpecialty}/${gotPriority} | ${item.turns.at(-1).slice(0, 70)}`);
  }
}
console.log(`\nMode: ${mode}`);
for (const [name, b] of Object.entries(totals)) {
  console.log(`${name}: fully right ${b.ok}/${b.n} | specialty ${b.specialty}/${b.n} | priority ${b.priority}/${b.n} | emergencies called Emergency ${b.emergenciesCaught}/${b.emergencies}`);
}
