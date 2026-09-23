import OpenAI from "openai";

// Kilo's OpenRouter-compatible endpoint is the default backend. It supports
// the keyless free route with the "anonymous" key. Env vars can still
// override this per deployment, but the assistant must not depend on Replit's
// managed OpenAI integration.
export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "anonymous",
  baseURL:
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    "https://api.kilo.ai/api/openrouter",
});
