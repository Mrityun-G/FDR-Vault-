// Claude document reading for the AICTE Institution Portal.
// Pure logic (no Deno / Supabase APIs) so it can be unit-tested with a fake client.
// The output is ADVISORY: deterministic statutory rules run separately in Postgres (submit_application).
import type Anthropic from "npm:@anthropic-ai/sdk@1.1.0";

export const MODEL = "claude-opus-5-5";

export const DOC_TYPES: Record<string, string> = {
  LAND_TITLE: "Land title / registered sale deed",
  BUILDING_NOC: "Building stability / completion certificate",
  FIRE_SAFETY: "Fire safety NOC",
  FDR_CORPUS: "Fixed Deposit Receipt (FDR) / term deposit advice under joint lien with AICTE",
  AFFILIATION: "University affiliation letter",
  STATE_NOC: "State Government / Directorate of Technical Education NOC",
  FACULTY_CADRE: "Certified faculty cadre register",
  BANK_LETTER: "Bank lien confirmation letter",
  AFFIDAVIT: "Affidavit / undertaking",
  OTHER: "Supporting document",
};

export const MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** What the institution declared in the form, used to cross-check the document. */
export interface Declared {
  institutionName: string;
  pid: string;
  fdrNumber?: string;
  amountInr?: number;
  bankName?: string;
  issueDate?: string;
  maturityDate?: string;
  validTill?: string;
  professors?: number;
  associateProfessors?: number;
  assistantProfessors?: number;
}

export interface Extraction {
  documentKind: string;
  matchesExpectedType: boolean;
  legibility: "clear" | "partially_legible" | "illegible";
  institutionNameInDocument: string;
  issuingAuthority: string;
  referenceNumber: string;
  issueDate: string;
  validTill: string;
  amountInr: string;
  fdrNumber: string;
  bankName: string;
  lienHolder: string;
  maturityDate: string;
  facultyProfessors: string;
  facultyAssociate: string;
  facultyAssistant: string;
  keyFields: { label: string; value: string; page: number; sourceLine: string }[];
  anomalies: string[];
  summary: string;
  confidence: number;
}

const str = (description: string) => ({ type: "string", description });

/** JSON schema for structured output. Every property is required; "" means "not present in the document". */
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["documentKind", "matchesExpectedType", "legibility", "institutionNameInDocument", "issuingAuthority", "referenceNumber",
    "issueDate", "validTill", "amountInr", "fdrNumber", "bankName", "lienHolder", "maturityDate", "facultyProfessors",
    "facultyAssociate", "facultyAssistant", "keyFields", "anomalies", "summary", "confidence"],
  properties: {
    documentKind: str("What the document actually is, in a few words"),
    matchesExpectedType: { type: "boolean", description: "True if the document is the expected document type" },
    legibility: { type: "string", enum: ["clear", "partially_legible", "illegible"] },
    institutionNameInDocument: str("Institution / trust name exactly as written in the document, or empty"),
    issuingAuthority: str("Authority or bank that issued the document, or empty"),
    referenceNumber: str("Certificate / reference / registration number, or empty"),
    issueDate: str("Issue date as YYYY-MM-DD, or empty"),
    validTill: str("Validity / expiry date as YYYY-MM-DD, or empty"),
    amountInr: str("Deposit amount in rupees as digits only (no commas), or empty"),
    fdrNumber: str("FDR / TDR / receipt number, or empty"),
    bankName: str("Bank name, or empty"),
    lienHolder: str("Lien holder / joint holder named in the deposit, or empty"),
    maturityDate: str("Deposit maturity date as YYYY-MM-DD, or empty"),
    facultyProfessors: str("Number of Professors as digits, or empty"),
    facultyAssociate: str("Number of Associate Professors as digits, or empty"),
    facultyAssistant: str("Number of Assistant Professors as digits, or empty"),
    keyFields: {
      type: "array",
      description: "Up to 8 most important fields, each with the exact source line it was read from",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "page", "sourceLine"],
        properties: { label: { type: "string" }, value: { type: "string" }, page: { type: "integer" }, sourceLine: { type: "string" } },
      },
    },
    anomalies: { type: "array", items: { type: "string" }, description: "Concrete problems visible in the document itself (alterations, missing seal/signature, inconsistent dates). Empty if none." },
    summary: str("Two sentences on what the document establishes"),
    confidence: { type: "number", description: "0 to 1: confidence in the extracted values" },
  },
} as const;

export const SYSTEM = `You read documents submitted by technical institutions to AICTE (All India Council for Technical Education) for regulatory scrutiny.
Extract only what is visibly written in the document. Never infer or invent a value: if a field is absent or unreadable, return an empty string.
Quote source lines verbatim. Report anomalies only when they are visible in the document. You are advisory: do not decide approval or compliance.`;

export function buildPrompt(docType: string, declared: Declared): string {
  const expected = DOC_TYPES[docType] ?? "Supporting document";
  return `Expected document type: ${expected} (${docType}).
Filing institution: ${declared.institutionName} (Permanent Institute ID ${declared.pid}).
Read the attached document and fill in every field of the output schema.`;
}

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const digits = (s: string) => s.replace(/[^0-9]/g, "");
function nameSimilarity(a: string, b: string): number {
  const A = new Set(norm(a).split(" ").filter((w) => w.length > 2)), B = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((w) => { if (B.has(w)) hit++; });
  return hit / Math.max(A.size, B.size);
}

/** Compares what Claude read with what the institution declared. Deterministic. */
export function crossCheck(x: Extraction, declared: Declared) {
  const fields: { label: string; value: string; page: number; sourceLine: string; isCoherent: boolean }[] = [];
  const mismatches: string[] = [];
  const add = (label: string, value: string, ok: boolean, mismatch?: string) => {
    if (!value) return;
    const src = x.keyFields.find((k) => norm(k.value) === norm(value) || norm(k.label).includes(norm(label).split(" ")[0]));
    fields.push({ label, value, page: src?.page ?? 0, sourceLine: src?.sourceLine ?? "", isCoherent: ok });
    if (!ok && mismatch) mismatches.push(mismatch);
  };
  if (x.institutionNameInDocument) {
    const ok = nameSimilarity(x.institutionNameInDocument, declared.institutionName) >= 0.6;
    add("Institution Name in Document", x.institutionNameInDocument, ok, `Document names "${x.institutionNameInDocument}", not the filing institution "${declared.institutionName}".`);
  }
  if (declared.fdrNumber !== undefined && x.fdrNumber) {
    add("FDR Number", x.fdrNumber, digits(x.fdrNumber) === digits(declared.fdrNumber) && norm(x.fdrNumber) === norm(declared.fdrNumber),
      `FDR number in document (${x.fdrNumber}) differs from the declared ${declared.fdrNumber}.`);
  }
  if (declared.amountInr !== undefined && x.amountInr) {
    add("Deposit Amount (₹)", x.amountInr, Number(digits(x.amountInr)) === Math.round(declared.amountInr),
      `Amount in document (₹${x.amountInr}) differs from the declared ₹${Math.round(declared.amountInr)}.`);
  }
  if (declared.maturityDate && x.maturityDate) add("Maturity Date", x.maturityDate, x.maturityDate === declared.maturityDate, `Maturity date in document (${x.maturityDate}) differs from the declared ${declared.maturityDate}.`);
  if (declared.issueDate && x.issueDate && declared.fdrNumber !== undefined) add("Issue Date", x.issueDate, x.issueDate === declared.issueDate, `Issue date in document (${x.issueDate}) differs from the declared ${declared.issueDate}.`);
  if (declared.bankName && x.bankName) add("Bank", x.bankName, nameSimilarity(x.bankName, declared.bankName) >= 0.5, `Bank in document (${x.bankName}) differs from the declared ${declared.bankName}.`);
  if (x.lienHolder) add("Lien Holder", x.lienHolder, /aicte|all india council/i.test(x.lienHolder), "Joint lien is not in favour of AICTE.");
  if (declared.validTill && x.validTill) add("Valid Till", x.validTill, x.validTill === declared.validTill, `Validity in document (${x.validTill}) differs from the declared ${declared.validTill}.`);
  else if (x.validTill) add("Valid Till", x.validTill, true);
  const cadre: [string, string, number | undefined][] = [["Professors", x.facultyProfessors, declared.professors], ["Associate Professors", x.facultyAssociate, declared.associateProfessors], ["Assistant Professors", x.facultyAssistant, declared.assistantProfessors]];
  for (const [label, v, d] of cadre) if (v && d !== undefined) add(label, v, Number(digits(v)) === d, `${label} in register (${v}) differs from the declared ${d}.`);
  if (x.issuingAuthority) add("Issuing Authority", x.issuingAuthority, true);
  if (x.referenceNumber) add("Reference Number", x.referenceNumber, true);
  for (const k of x.keyFields) if (!fields.some((f) => norm(f.value) === norm(k.value))) fields.push({ ...k, isCoherent: true });
  return { fields: fields.slice(0, 14), mismatches };
}

export interface AnalysisResult {
  extraction: Extraction;
  fields: ReturnType<typeof crossCheck>["fields"];
  mismatches: string[];
  status: "ok" | "warn" | "fail";
  analysis: { status: string; modelUsed: string; timestamp: string; summary: string; verifiedAttributes: Record<string, string>; detectedAnomalies: string[]; disclaimer: string; confidence: number };
}

export class RefusedError extends Error {}

/** Reads one document with Claude and cross-checks it against the declared values. */
export async function analyzeDocument(client: Anthropic, file: { base64: string; mediaType: MediaType }, docType: string, declared: Declared): Promise<AnalysisResult> {
  const source = file.mediaType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: file.base64 } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: file.mediaType, data: file.base64 } };

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: [source, { type: "text", text: buildPrompt(docType, declared) }] }],
  });

  if (response.stop_reason === "refusal") throw new RefusedError(response.stop_details?.explanation ?? "The model declined to read this document.");
  if (response.stop_reason === "max_tokens") throw new Error("Document analysis was cut off (max_tokens).");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No analysis returned.");
  const extraction = JSON.parse(text.text) as Extraction;

  const { fields, mismatches } = crossCheck(extraction, declared);
  const nameMismatch = fields.some((f) => f.label === "Institution Name in Document" && !f.isCoherent);
  const anomalies = [...mismatches, ...extraction.anomalies];
  if (!extraction.matchesExpectedType) anomalies.unshift(`Document appears to be "${extraction.documentKind}", not the expected ${DOC_TYPES[docType] ?? docType}.`);
  if (extraction.legibility !== "clear") anomalies.push(`Document is ${extraction.legibility.replace("_", " ")} — values may be unreliable.`);
  const status = nameMismatch || !extraction.matchesExpectedType || extraction.legibility === "illegible" ? "fail" : anomalies.length ? "warn" : "ok";
  const verifiedAttributes: Record<string, string> = {};
  for (const f of fields.slice(0, 5)) verifiedAttributes[f.label] = `${f.value}${f.isCoherent ? "" : " (mismatch)"}`;
  return {
    extraction, fields, mismatches, status,
    analysis: {
      status: "COMPLETED", modelUsed: response.model, timestamp: new Date().toISOString(), summary: extraction.summary, verifiedAttributes,
      detectedAnomalies: anomalies, confidence: extraction.confidence,
      disclaimer: "AI reading of the uploaded document. Advisory only — statutory checks and the Scrutiny Committee decide.",
    },
  };
}
