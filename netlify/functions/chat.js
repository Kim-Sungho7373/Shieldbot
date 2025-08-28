import OpenAI from "openai";

// 환경변수 누락 시 바로 500 내보내는 가드
function missingKey() {
  return {
    statusCode: 500,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Missing OPENAI_API_KEY" })
  };
}

function detectRedFlags(text = "") {
  const flags = [
    /secret|keep this between us|don.?t tell/i,
    /send (a )?(pic|selfie|photo|video)/i,
    /meet (up|alone)|hang out just us/i,
    /(snap|kakao|telegram|discord|line|whatsapp|dm)\b/i,
    /address|where (do )?you live|what school/i,
    /gift|allowance|i'll pay|money|send you cash/i,
    /how old are you|age/i
  ];
  return flags.some(r => r.test(text));
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!process.env.OPENAI_API_KEY) return missingKey();

    const { messages = [], scenario = "General" } = JSON.parse(event.body || "{}");

    const SYSTEM_PROMPT = `
You are simulating the OTHER PERSON in a teen online safety training chat.
Stay strictly PG-13. No explicit sexual content and never sexualize minors.
Use short, casual replies (<= 30 words). Subtle red flags only.
`;

    const hintMap = {
      "A Person Claiming to be a Casting Manager":
        "You claim you're a casting manager. Sound professional but never ask for explicit content.",
      "Stranger Met in a Game":
        "You met the user in an online game. Friendly gamer vibe.",
      "Friend Met on Social Media":
        "You are a teen peer on social media. Casual and friendly."
    };
    const scenarioHint = hintMap[scenario] || "General small talk.";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Responses API 호출
    const ai = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Scenario: ${scenario} — Hint: ${scenarioHint}` },
        ...messages
      ]
    });

    const botText = (ai.output_text || "").trim() || "Okay.";
    const isGroomingAttempt = detectRedFlags(botText);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({ reply: { content: botText, isGroomingAttempt } })
    };
  } catch (err) {
    console.error("chat function error:", err);
    const fallback = "Sorry—having trouble. Let’s try again in a bit.";
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reply: { content: fallback, isGroomingAttempt: false } })
    };
  }
}
