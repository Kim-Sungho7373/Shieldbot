// netlify/functions/chat.js
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 안전 가드: 민감한/노골적 내용 없이 경고 신호만 시뮬레이션
const SYSTEM_PROMPT = `
You are simulating the OTHER PERSON in a teen online safety training chat.
Stay strictly PG-13. No explicit sexual content, no nudity, no fetishization, no sexual talk about minors. 
You may include subtle red flags (secrecy, moving platforms, gifts, pressuring for selfies, asking address/school),
but keep it brief (<= 30 words), casual, and never graphic. If the user asks anything sexual, decline politely.
Respond in the style suitable for the scenario; 1–2 short sentences.
`;

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

export default async (request) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method Not Allowed" }, { status: 405 });
    }

    const { messages = [], scenario = "General" } = await request.json();

    // 시나리오 힌트 부여
    const scenarioHint = {
      "A Person Claiming to be a Casting Manager":
        "You claim you're a casting manager. Sound professional but do not ask for explicit content.",
      "Stranger Met in a Game":
        "You met the user in an online game. Sound friendly, casual gamer slang ok.",
      "Friend Met on Social Media":
        "You are a teen peer on social media. Be casual and friendly."
    }[scenario] || "General small talk.";

    // OpenAI로 답장 생성 (Responses API)
    // SDK 사용 예시는 OpenAI 공식 문서의 Responses API 가이드를 따릅니다.
    // (responses.create, 모델 선택 등) :contentReference[oaicite:2]{index=2}
    const ai = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Scenario: ${scenario} — Hint: ${scenarioHint}` },
        ...messages
      ]
    });

    // 편의 속성 output_text (문서화됨)
    const botText = (ai.output_text || "").trim() || "Hmm…";

    const isGroomingAttempt = detectRedFlags(botText);

    return Response.json(
      { reply: { content: botText, isGroomingAttempt } },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    // API 키가 없거나 에러일 때의 안전한 폴백
    const fallback = "Let's chat here. What games do you play lately?";
    return Response.json(
      { reply: { content: fallback, isGroomingAttempt: detectRedFlags(fallback) } },
      { status: 200 }
    );
  }
};
