// Unit test for the Claude document reader with a fake Anthropic client (no network, no cost).
// Run: node supabase/functions/analyze-document/extract.test.ts   (Node 22.6+ strips the TS types)
import { analyzeDocument, crossCheck, MODEL, RefusedError, SCHEMA, type Declared, type Extraction } from "./extract.ts";

let failed = 0;
const ok = (cond: unknown, msg: string) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) failed++; };

const base: Extraction = {
  documentKind: "Term deposit receipt", matchesExpectedType: true, legibility: "clear",
  institutionNameInDocument: "Delhi Institute of Technology and Science", issuingAuthority: "State Bank of India", referenceNumber: "",
  issueDate: "2024-04-01", validTill: "", amountInr: "10000000", fdrNumber: "SBI-FDR-99201-2024", bankName: "State Bank of India",
  lienHolder: "Regional Officer, Northern Regional Office, AICTE", maturityDate: "2034-03-31",
  facultyProfessors: "", facultyAssociate: "", facultyAssistant: "",
  keyFields: [{ label: "FDR Number", value: "SBI-FDR-99201-2024", page: 1, sourceLine: "Term Deposit Receipt No: SBI-FDR-99201-2024" }],
  anomalies: [], summary: "FDR of ₹1 crore under joint lien with AICTE.", confidence: 0.93,
};
const declared: Declared = { institutionName: "Delhi Institute of Technology & Science", pid: "1-10928371", fdrNumber: "SBI-FDR-99201-2024", amountInr: 10000000, bankName: "State Bank of India", issueDate: "2024-04-01", maturityDate: "2034-03-31" };

function fakeClient(reply: { stop_reason: string; text?: string; stop_details?: { explanation: string } }) {
  const calls: any[] = [];
  const client = { beta: { messages: { create: async (params: any) => { calls.push(params); return { model: MODEL, stop_reason: reply.stop_reason, stop_details: reply.stop_details ?? null, content: reply.text ? [{ type: "text", text: reply.text }] : [] }; } } } };
  return { client: client as any, calls };
}

console.log("Request shape");
{
  const { client, calls } = fakeClient({ stop_reason: "end_turn", text: JSON.stringify(base) });
  const r = await analyzeDocument(client, { base64: "JVBERi0=", mediaType: "application/pdf" }, "FDR_CORPUS", declared);
  const p = calls[0];
  ok(p.model === "claude-opus-5-5", "uses claude-opus-5-5");
  ok(p.fallbacks === "default" && p.betas.includes("server-side-fallback-2026-07-01"), "server-side refusal fallback enabled");
  ok(p.output_config.format.type === "json_schema" && p.output_config.format.schema === SCHEMA && p.output_config.effort === "medium", "structured output schema + explicit effort");
  ok(p.messages[0].content[0].type === "document" && p.messages[0].content[0].source.media_type === "application/pdf", "PDF sent as a document block before the text");
  ok(!("temperature" in p) && !("thinking" in p), "no sampling params / disabled thinking (rejected on this model)");
  ok(r.status === "ok" && r.mismatches.length === 0, "matching FDR → ok, no mismatches");
  ok(r.fields.find((f) => f.label === "FDR Number")?.sourceLine.includes("SBI-FDR-99201-2024"), "fields carry verbatim source lines");
}

console.log("\nCross-checks against declared values");
{
  const tampered = { ...base, amountInr: "8000000", maturityDate: "2030-03-31" };
  const c = crossCheck(tampered, declared);
  ok(c.mismatches.some((m) => m.includes("8000000")), "amount mismatch detected (₹80 lakh vs ₹1 crore)");
  ok(c.mismatches.some((m) => m.includes("2030-03-31")), "maturity date mismatch detected");
  const other = crossCheck({ ...base, institutionNameInDocument: "Deccan Institute of Advanced Studies" }, declared);
  ok(other.fields.some((f) => f.label === "Institution Name in Document" && !f.isCoherent), "document naming another institution flagged");
  ok(crossCheck({ ...base, lienHolder: "Delhi Institute Trust" }, declared).mismatches.includes("Joint lien is not in favour of AICTE."), "lien not in favour of AICTE flagged");
  const cadre = crossCheck({ ...base, institutionNameInDocument: "", fdrNumber: "", amountInr: "", maturityDate: "", lienHolder: "", bankName: "", facultyProfessors: "8", facultyAssociate: "28", facultyAssistant: "82" },
    { institutionName: "x", pid: "y", professors: 14, associateProfessors: 28, assistantProfessors: 82 });
  ok(cadre.mismatches.length === 1 && cadre.mismatches[0].startsWith("Professors"), "faculty register count mismatch detected");
}

console.log("\nStatus & failure handling");
{
  const { client } = fakeClient({ stop_reason: "end_turn", text: JSON.stringify({ ...base, institutionNameInDocument: "Deccan Institute of Advanced Studies" }) });
  ok((await analyzeDocument(client, { base64: "x", mediaType: "image/png" }, "LAND_TITLE", declared)).status === "fail", "wrong institution → fail");
  const wrongType = fakeClient({ stop_reason: "end_turn", text: JSON.stringify({ ...base, matchesExpectedType: false, documentKind: "Electricity bill" }) });
  const w = await analyzeDocument(wrongType.client, { base64: "x", mediaType: "image/jpeg" }, "FIRE_SAFETY", declared);
  ok(w.status === "fail" && w.analysis.detectedAnomalies[0].includes("Electricity bill"), "wrong document type → fail with reason");
  ok(wrongType.calls[0].messages[0].content[0].type === "image", "images sent as image blocks");
  const refused = fakeClient({ stop_reason: "refusal", stop_details: { explanation: "declined" } });
  let threw: unknown = null;
  try { await analyzeDocument(refused.client, { base64: "x", mediaType: "application/pdf" }, "OTHER", declared); } catch (e) { threw = e; }
  ok(threw instanceof RefusedError, "refusal stop_reason surfaces as RefusedError (never a silent pass)");
  const cut = fakeClient({ stop_reason: "max_tokens", text: "{" });
  threw = null;
  try { await analyzeDocument(cut.client, { base64: "x", mediaType: "application/pdf" }, "OTHER", declared); } catch (e) { threw = e; }
  ok(threw instanceof Error && String((threw as Error).message).includes("max_tokens"), "truncated output is an error, not partial data");
}

console.log(failed ? `\n${failed} failed` : "\nALL EXTRACT TESTS PASSED");
process.exit(failed ? 1 : 0);
