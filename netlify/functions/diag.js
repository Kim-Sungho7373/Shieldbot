// netlify/functions/diag.js
export async function handler() {
  console.log("diag invoked, env key present?:", Boolean(process.env.OPENAI_API_KEY));
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hasKey: Boolean(process.env.OPENAI_API_KEY),
      node: process.version
    })
  };
}
