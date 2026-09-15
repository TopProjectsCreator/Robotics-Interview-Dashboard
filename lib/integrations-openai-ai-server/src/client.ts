import OpenAI from "openai";

// Kilo AI Gateway is the default backend (OpenAI-compatible, free tier works
// with the "anonymous" key). Env vars override per deployment, but the server
// must boot and serve the dashboard even when they are absent.
export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "anonymous",
  baseURL:
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    "https://api.kilo.ai/api/gateway",
});
