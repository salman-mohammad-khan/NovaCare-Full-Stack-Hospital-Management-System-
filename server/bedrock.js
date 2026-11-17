// Minimal Amazon Bedrock Converse client over fetch (no SDK). It needs a Bedrock API key in AWS_BEARER_TOKEN_BEDROCK;
// without one the health assistant keeps using its rules and the local model.
//
// The key is read at call time and is never logged or stored. After three failed calls in a row Bedrock is skipped for
// 30 seconds, so a bad key or an outage does not make every patient wait for a timeout.

const MAX_FAILURES = 3;
const PAUSE_MS = 30_000;
let failures = 0;
let pausedUntil = 0;

// A pasted key can carry a byte-order mark or a newline, which makes the Authorization header invalid.
export const bedrockKey = () => {
  const key = String(process.env.AWS_BEARER_TOKEN_BEDROCK ?? "").trim();
  return key.charCodeAt(0) === 0xfeff ? key.slice(1).trim() : key;
};

export const bedrockEnabled = () => Boolean(bedrockKey()) && process.env.BEDROCK_TRIAGE !== "false";

export const bedrockConfig = () => ({
  region: process.env.BEDROCK_REGION ?? "ap-south-1",
  model: process.env.BEDROCK_MODEL_ID ?? "openai.gpt-oss-20b-1:0",
  timeoutMs: Number(process.env.BEDROCK_TIMEOUT_MS ?? 15_000),
  // gpt-oss thinks before it answers; "low" keeps that short (about 20 tokens against 60 at "medium" in a test).
  reasoningEffort: process.env.BEDROCK_REASONING_EFFORT ?? "low",
});

export function resetBedrockState() {
  failures = 0;
  pausedUntil = 0;
}

/** One Converse call. Returns the reply text, or null on any failure (nothing is thrown). */
export async function converse({ system, user, maxTokens = 400 }) {
  if (!bedrockEnabled() || Date.now() < pausedUntil) {
    return null;
  }
  const config = bedrockConfig();
  const url = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(config.model)}/converse`;
  const body = {
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens, temperature: 0 },
  };
  if (config.model.includes("gpt-oss") && config.reasoningEffort) {
    body.additionalModelRequestFields = { reasoning_effort: config.reasoningEffort };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bedrockKey()}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  try {
    let response = await send();
    if (response.status === 429) {
      // The account allows about 100 requests a minute per model; a short pause usually clears a burst.
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
      response = await send();
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const text = (data?.output?.message?.content ?? []).map((block) => block?.text ?? "").join("").trim();
    failures = 0;
    return text || null;
  } catch (error) {
    // Only the error type and status are logged, never the request, so the key cannot leak.
    failures += 1;
    console.warn(`Bedrock call failed (${error?.name}: ${error?.message}), ${failures} in a row`);
    if (failures >= MAX_FAILURES) {
      pausedUntil = Date.now() + PAUSE_MS;
      failures = 0;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
