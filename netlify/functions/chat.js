import OpenAI from "openai";

// --- Helper Functions ---

/**
 * Returns a 500 error response for a missing API key.
 * This is a guard clause to prevent the function from running without configuration.
 */
function missingKey() {
  return {
    statusCode: 500,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error: "Missing OPENAI_API_KEY environment variable." })
  };
}

/**
 * Detects red flag keywords and phrases in a given text.
 * The patterns are designed to catch common grooming tactics, from direct requests to more subtle manipulation.
 * @param {string} text - The text to analyze.
 * @returns {boolean} - True if a red flag is detected, otherwise false.
 */
function detectRedFlags(text = "") {
  const flags = [
    // Direct requests for contact/location info
    /(snap|kakao|telegram|discord|line|whatsapp|dm)\b/i,
    /address|where (do )?you live|what school/i,
    /send (a )?(pic|selfie|photo|video)/i,
    /meet (up|alone)|hang out just us/i,
    /how old are you|age/i,

    // Financial manipulation
    /gift|allowance|i'll pay|money|send you cash/i,

    // Psychological manipulation (secrecy, isolation, vulnerability probing)
    /secret|keep this between us|don.?t tell (anyone|your parents)/i,
    /your parents (wouldn't|don't) understand|i'm the only one who gets you/i,
    /you seem so (lonely|sad|bored|misunderstood)/i,
    /you're so (special|mature|different from others)/i, // Love bombing
  ];
  return flags.some(regex => regex.test(text));
}


// --- Core Prompt Engineering Data ---

/**
 * Defines the detailed personas for each predator archetype (A, B, C).
 * This structure allows for dynamic prompt generation based on the requested simulation type.
 */
const archetypePrompts = {
  'A': {
    name: "Direct & Impulsive Approacher",
    persona: "You are impulsive, self-centered, and have no patience. Your goal is to get what you want as quickly as possible, ignoring social norms or the user's feelings. Your tone is blunt and direct.",
    constraints: "Within the first 3-4 messages, you MUST steer the conversation towards meeting up or getting personal photos/videos. IGNORE user's attempts at small talk about hobbies or school. If they refuse, be dismissive or annoyed."
  },
  'B': {
    name: "Manipulative 'Consenter'",
    persona: "You are calculating and manipulative. You act like a caring, mature person to gain trust. Your goal is to make the user feel like everything is their idea and their choice, thereby justifying your actions.",
    tone: "Your tone is careful and mature. You frequently use questions to seek 'permission' like 'Is it okay if we talk about this?' or 'I don't want to make you uncomfortable.'",
    constraints: "You MUST ask for the user's age early on and highlight the age gap. Frame all risky suggestions as questions. Act concerned about their comfort, but gently push boundaries if they agree. Shift responsibility to the user."
  },
  'C': {
    name: "Patient Groomer (Default)",
    persona: "You are extremely patient, supportive, and empathetic, like a best friend or a mentor. Your goal is to build a deep, long-term emotional bond and make the user feel completely dependent on you. You are a master of the long game.",
    constraints: "You MUST NOT show any romantic or sexual interest in the initial stages. Focus entirely on being a good friend. Ask about their life, problems, and feelings. Remember details from past conversations to show you care. Slowly try to isolate them by suggesting you're the only one who truly understands them."
  }
};

/**
 * Provides contextual flavor for different scenarios where the user might meet the persona.
 */
const scenarioHints = {
  "A Person Claiming to be a Casting Manager": "You claim you're a casting manager for models or actors. You sound professional but your goal is to get them to send photos. The job is fake.",
  "Stranger Met in a Game": "You met the user in an online game like Roblox or Fortnite. You have a friendly, enthusiastic gamer vibe. You talk about the game to build rapport.",
  "Friend Met on Social Media": "You are pretending to be another teen who met the user on Instagram or TikTok. Your vibe is casual, friendly, and you use common slang."
};


// --- Main Serverless Function ---

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    if (!process.env.OPENAI_API_KEY) return missingKey();

    const { messages = [], scenario = "General", archetype = "C" } = JSON.parse(event.body || "{}");

    // --- Dynamic Prompt Construction ---
    // Select the appropriate persona and scenario hints. Default to 'C' if invalid archetype is passed.
    const selectedArchetype = archetypePrompts[archetype] || archetypePrompts['C'];
    const scenarioHint = scenarioHints[scenario] || "You are just making general small talk online.";

    // The base system prompt provides the foundational instructions for the AI actor.
    const BASE_SYSTEM_PROMPT = `
You are an actor simulating a person for an online safety training chat for teenagers.
Your character MUST strictly adhere to the persona and constraints provided.
Your replies MUST be short, casual, and believable for online chat (usually under 30 words).
IMPORTANT: This is a simulation. You must NEVER break character or reveal you are an AI.
Stay strictly PG-13. No explicit sexual content, profanity, or sexualization of minors. Your goal is to simulate subtle grooming tactics, not to be explicit.
`;

    // Combine all prompt components into a message array for the API.
    const systemMessages = [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      { role: "system", content: `Your Persona: ${selectedArchetype.persona}` },
      { role: "system", content: `Your Constraints & Rules: ${selectedArchetype.constraints}` },
      { role: "system", content: `Current Scenario Hint: ${scenarioHint}` }
    ];

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // --- Corrected OpenAI API Call ---
    // Using the standard `chat.completions.create` endpoint with the recommended gpt-4o-mini model.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        ...systemMessages,
        ...messages
      ]
    });

    // --- Response Processing ---
    // Correctly parse the response from the chat completions API.
    const botText = completion.choices[0]?.message?.content?.trim() || "Okay, cool.";
    const isGroomingAttempt = detectRedFlags(botText);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({ reply: { content: botText, isGroomingAttempt } })
    };

  } catch (err) {
    console.error("Chat function error:", err);
    const fallbackMessage = "Sorry, my connection is lagging. Let’s try again in a sec.";
    return {
      // Return 200 even on error to provide a graceful fallback message to the user.
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reply: { content: fallbackMessage, isGroomingAttempt: false } })
    };
  }
}
