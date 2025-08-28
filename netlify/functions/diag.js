export async function handler() {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hasKey: Boolean(process.env.OPENAI_API_KEY),
      node: process.version
    })
  };
}
