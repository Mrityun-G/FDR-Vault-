// Supabase Edge Function: the Evaluator Guide chat. Claude answers questions about the prototype and looks up the
// real implementation in a snapshot of the source (corpus.ts, rebuilt by `node scripts/build-guide-corpus.mjs`).
// Deploy:  supabase functions deploy evaluator-guide --no-verify-jwt     Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Public (evaluators may not be signed in), so each caller is rate-limited and inputs are capped.
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { answerQuestion, type ChatTurn, MAX_QUESTION, type PageContext, RefusedError } from "./agent.ts";
import { CORPUS } from "./corpus.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
const README = CORPUS["README.md"] ?? "";

// Best-effort per-IP limit (per function instance): 20 questions per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000, LIMIT = 20;
const seen = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (seen.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) { seen.set(ip, recent); return false; }
  recent.push(now);
  seen.set(ip, recent);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { code: "METHOD_NOT_ALLOWED", message: "Use POST." });
  if (!anthropic) return reply(503, { code: "AI_NOT_CONFIGURED", message: "The AI guide is not configured." });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!allow(ip)) return reply(429, { code: "RATE_LIMITED", message: "Too many questions — please wait a few minutes." });

  let body: { question?: unknown; history?: unknown; context?: unknown };
  try { body = await req.json(); } catch { return reply(400, { code: "VALIDATION", message: "Invalid JSON body." }); }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return reply(400, { code: "VALIDATION", message: "Ask a question." });
  if (question.length > MAX_QUESTION) return reply(400, { code: "VALIDATION", message: `Questions are limited to ${MAX_QUESTION} characters.` });
  const history = Array.isArray(body.history) ? body.history as ChatTurn[] : [];
  const context = (body.context && typeof body.context === "object" ? body.context : {}) as PageContext;

  try {
    return reply(200, await answerQuestion(anthropic, CORPUS, README, question, history, context));
  } catch (e) {
    if (e instanceof RefusedError) return reply(422, { code: "AI_DECLINED", message: e.message });
    if (e instanceof Anthropic.RateLimitError) return reply(429, { code: "RATE_LIMITED", message: "The AI service is busy — try again shortly." });
    if (e instanceof Anthropic.AuthenticationError) return reply(503, { code: "AI_NOT_CONFIGURED", message: "The AI guide is not configured." });
    if (e instanceof Anthropic.APIError) return reply(502, { code: "AI_UNAVAILABLE", message: `AI service error (${e.status}).` });
    return reply(500, { code: "AI_FAILED", message: e instanceof Error ? e.message : "The guide could not answer." });
  }
});
