// Supabase Edge Function: reads an uploaded institution document with Claude and cross-checks it
// against the values the institution declared. Deploy:  supabase functions deploy analyze-document
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from "npm:@anthropic-ai/sdk@1.1.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { analyzeDocument, type Declared, DOC_TYPES, MEDIA_TYPES, type MediaType, RefusedError } from "./extract.ts";

const BUCKET = "institution-documents";
const MAX_BYTES = 10 * 1024 * 1024;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Created only when the secret exists, so a missing key yields AI_NOT_CONFIGURED instead of a boot failure.
const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { code: "METHOD_NOT_ALLOWED", message: "Use POST." });
  if (!anthropic) return reply(503, { code: "AI_NOT_CONFIGURED", message: "AI service is not configured." });

  const url = Deno.env.get("SUPABASE_URL")!;
  // Identify the caller with their own JWT; RLS-backed helper returns their institution only if ACTIVE.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: institutionId, error: idErr } = await asUser.rpc("my_institution_id");
  if (idErr || !institutionId) return reply(403, { code: "FORBIDDEN", message: "Only active institution accounts can analyse documents." });

  let body: { storagePath?: string; docType?: string; mimeType?: string; declared?: Partial<Declared> };
  try { body = await req.json(); } catch { return reply(400, { code: "VALIDATION", message: "Invalid JSON body." }); }
  const { storagePath = "", docType = "", mimeType = "" } = body;
  if (!storagePath.startsWith(`${institutionId}/`) || storagePath.includes("..")) return reply(403, { code: "FORBIDDEN", message: "Document is not in your institution's folder." });
  if (!(docType in DOC_TYPES)) return reply(400, { code: "VALIDATION", message: "Unknown document type." });
  if (!MEDIA_TYPES.includes(mimeType as MediaType)) return reply(400, { code: "VALIDATION", message: "Only PDF, JPG or PNG documents can be analysed." });

  // Download with the service role (storage policies already restrict who could upload there).
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(storagePath);
  if (dlErr || !blob) return reply(404, { code: "NOT_FOUND", message: "Document not found in storage." });
  if (blob.size > MAX_BYTES) return reply(413, { code: "VALIDATION", message: "Document exceeds 10 MB." });

  const { data: inst } = await admin.from("institutions").select("name, pid").eq("id", institutionId).single();
  const d = body.declared ?? {};
  const declared: Declared = {
    institutionName: inst?.name ?? "", pid: inst?.pid ?? "",
    fdrNumber: d.fdrNumber, amountInr: d.amountInr, bankName: d.bankName, issueDate: d.issueDate, maturityDate: d.maturityDate,
    validTill: d.validTill, professors: d.professors, associateProfessors: d.associateProfessors, assistantProfessors: d.assistantProfessors,
  };

  try {
    const result = await analyzeDocument(anthropic, { base64: encodeBase64(new Uint8Array(await blob.arrayBuffer())), mediaType: mimeType as MediaType }, docType, declared);
    await admin.rpc("_audit", {
      p_inst: institutionId, p_actor: null, p_actor_name: "AI Document Reader", p_actor_role: "SYSTEM", p_action: "AI_DOCUMENT_ANALYSIS",
      p_target_type: "DOCUMENT", p_target_id: storagePath.split("/").pop(),
      p_details: `${docType}: ${result.status.toUpperCase()} (${result.analysis.modelUsed}, confidence ${result.analysis.confidence}); ${result.mismatches.length} mismatch(es) with declared values.`,
    }).then(() => {}, () => {}); // audit is best-effort here
    return reply(200, result);
  } catch (e) {
    if (e instanceof RefusedError) return reply(422, { code: "AI_DECLINED", message: e.message });
    if (e instanceof Anthropic.RateLimitError) return reply(429, { code: "RATE_LIMITED", message: "AI service is busy — try again shortly." });
    if (e instanceof Anthropic.AuthenticationError) return reply(503, { code: "AI_NOT_CONFIGURED", message: "AI service is not configured." });
    if (e instanceof Anthropic.APIError) return reply(502, { code: "AI_UNAVAILABLE", message: `AI service error (${e.status}).` });
    return reply(500, { code: "AI_FAILED", message: e instanceof Error ? e.message : "Analysis failed." });
  }
});
