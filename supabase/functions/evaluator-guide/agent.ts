// Evaluator Guide agent: answers SIH evaluators' questions about the AI-IRVP prototype with Claude, looking up the
// real implementation through three read-only tools over a snapshot of the source (corpus.ts).
// Pure logic (no Deno / Supabase APIs) so it can be unit-tested with a fake client.
import type Anthropic from "npm:@anthropic-ai/sdk@1.1.0";

export const MODEL = "claude-opus-5-5";
export const MAX_STEPS = 8;            // model calls per question (each may run several tools)
export const MAX_QUESTION = 1500;
export const MAX_HISTORY = 12;         // earlier chat messages kept (text only)
const MAX_READ_LINES = 250;
const MAX_MATCHES = 40;

export type Corpus = Record<string, string>;
export interface ChatTurn { role: "user" | "assistant"; text: string }
export interface PageContext { site?: string; portal?: string; screen?: string; signedIn?: boolean }
export interface GuideAnswer { answer: string; sources: string[]; steps: number }
export class RefusedError extends Error {}

const SYSTEM = `You are the Evaluator Guide for the "AICTE Intelligent Regulatory Validation Platform" (AI-IRVP), a Smart India Hackathon (SIH) prototype. The people talking to you are SIH evaluators who must understand and mark the prototype quickly.

Your job:
- Explain what the prototype does, how each feature works, and how it is implemented, in plain language a non-specialist judge can follow.
- Teach step by step when asked how to do something: say which portal, which demo account, which button, and what they should see.
- Ground implementation answers in the real code. Before you state how something is implemented (a rule, a database function, a security check, a screen), look it up with the tools and mention where it lives as \`path:line\`. Don't invent file names, functions, numbers or features. If the code doesn't contain something, say so plainly.
- Be honest about what is simulated (Aadhaar e-Sign / DSC, issuing-authority checks such as DTE, University, Fire, NBA and bank CBS gateways) versus real and running.

Style:
- Short and scannable: a one-line answer first, then a few bullets or numbered steps. Use **bold** for UI labels and \`code\` for file paths, function and table names. No tables, no headings above level 3.
- Reply in the evaluator's language (English or Hindi).
- Stay on the topic of this prototype. For unrelated requests, say briefly that you can only help with the prototype.

Facts you can rely on without looking up:
- Three portals on one Supabase (Postgres) backend: Institution app (mobile PWA + Android) at https://fdr-vault.vercel.app; Officer portal (scrutiny officers = REVIEWER, bank officials = BANK_OFFICIAL) at https://fdr-vault-sbf7.vercel.app/officer; Admin console (ADMIN) at https://fdr-vault-sbf7.vercel.app/admin. Locally: http://localhost:8765 and http://localhost:5180/officer, /admin.
- Demo accounts (one-click buttons on every login screen), password Sih@2026Demo: sih_demo.institution@example.com (DITS Delhi), sih_demo.officer@example.com, sih_demo.bank@example.com (SBI), sih_demo.admin@example.com.
- The project README is attached below as background; the source code is reachable only through the tools.`;

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "list_files",
    description: "List every source file in the prototype snapshot with its line count. Use it to find where a part of the system lives (institution app: app.js/backend.js; staff portal: web-portal/src; database, security and workflow: supabase/migrations/*.sql; AI document reading: supabase/functions/analyze-document).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_code",
    description: "Search the source for a case-insensitive regular expression and return matching lines as path:line: text (at most 40). Use it to locate functions, rules, tables, UI labels or constants before reading them.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JavaScript regular expression, e.g. \"submit_application\" or \"RULE-FDR\"." },
        path_prefix: { type: "string", description: "Optional: only search files whose path starts with this, e.g. \"supabase/migrations\" or \"web-portal/src\"." },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    description: "Read lines of one source file (at most 250 lines per call), numbered. Use after search_code to read the surrounding implementation.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Exact path as returned by list_files or search_code." },
        start_line: { type: "integer", description: "First line to return (1-based). Default 1." },
        end_line: { type: "integer", description: "Last line to return. Default start_line + 199." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
];

/** Runs one tool call against the corpus. Inputs are model output, so they are validated here. */
export function runTool(corpus: Corpus, name: string, input: unknown, sources: Set<string>): { text: string; isError: boolean } {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (name === "list_files") {
    return { text: Object.entries(corpus).map(([p, s]) => `${p} (${s.split("\n").length} lines)`).join("\n"), isError: false };
  }
  if (name === "search_code") {
    if (typeof args.pattern !== "string" || !args.pattern) return { text: "pattern is required.", isError: true };
    let re: RegExp;
    try { re = new RegExp(args.pattern, "i"); } catch { return { text: `Invalid regular expression: ${args.pattern}`, isError: true }; }
    const prefix = typeof args.path_prefix === "string" ? args.path_prefix : "";
    const hits: string[] = [];
    for (const [p, src] of Object.entries(corpus)) {
      if (!p.startsWith(prefix)) continue;
      const lines = src.split("\n");
      for (let i = 0; i < lines.length && hits.length < MAX_MATCHES; i++) {
        if (re.test(lines[i])) { hits.push(`${p}:${i + 1}: ${lines[i].trim().slice(0, 200)}`); sources.add(p); }
      }
      if (hits.length >= MAX_MATCHES) break;
    }
    return { text: hits.length ? hits.join("\n") + (hits.length >= MAX_MATCHES ? "\n(more matches not shown — narrow the pattern or path_prefix)" : "") : "No matches.", isError: false };
  }
  if (name === "read_file") {
    const p = typeof args.path === "string" ? args.path : "";
    const src = corpus[p];
    if (src === undefined) return { text: `No such file: ${p}. Use list_files for exact paths.`, isError: true };
    const lines = src.split("\n");
    const start = Math.max(1, Number.isInteger(args.start_line) ? args.start_line as number : 1);
    const end = Math.min(lines.length, start + MAX_READ_LINES - 1, Number.isInteger(args.end_line) ? args.end_line as number : start + 199);
    if (start > lines.length) return { text: `${p} has only ${lines.length} lines.`, isError: true };
    sources.add(p);
    return { text: lines.slice(start - 1, end).map((l, i) => `${start + i}\t${l}`).join("\n") + (end < lines.length ? `\n(${lines.length - end} more lines)` : ""), isError: false };
  }
  return { text: `Unknown tool: ${name}`, isError: true };
}

const describeContext = (c: PageContext) => {
  const where = c.site === "staff" ? `the ${c.portal === "admin" ? "Admin console" : "Officer portal"}` : "the Institution app";
  return `[The evaluator is on ${where}${c.screen ? `, screen "${c.screen}"` : ""}, ${c.signedIn ? "signed in" : "not signed in"}.]`;
};

/** Answers one question, letting Claude call the code tools until it has what it needs. */
export async function answerQuestion(client: Anthropic, corpus: Corpus, readme: string, question: string, history: ChatTurn[] = [], context: PageContext = {}): Promise<GuideAnswer> {
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-MAX_HISTORY)
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string" && t.text.trim())
    .map((t) => ({ role: t.role, content: t.text.slice(0, 4000) }));
  while (messages.length && messages[0].role !== "user") messages.shift();   // the API needs a user turn first
  messages.push({ role: "user", content: `${describeContext(context)}\n\n${question.slice(0, MAX_QUESTION)}` });

  const sources = new Set<string>();
  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      // Stable prefix (tools, then instructions + README) is cached; the conversation comes after it.
      system: [{ type: "text", text: SYSTEM }, { type: "text", text: `<readme>\n${readme}\n</readme>`, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") throw new RefusedError(response.stop_details?.explanation ?? "The guide declined to answer this question.");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (response.stop_reason !== "tool_use") {
      if (response.stop_reason === "max_tokens" && !text) throw new Error("The answer was cut off.");
      return { answer: text || "I couldn't find an answer to that.", sources: [...sources], steps: step };
    }

    messages.push({ role: "assistant", content: response.content });   // keep thinking + tool_use blocks unchanged
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = response.content.flatMap((b) => {
      if (b.type !== "tool_use") return [];
      const r = runTool(corpus, b.name, b.input, sources);
      return [{ type: "tool_result" as const, tool_use_id: b.id, content: r.text, is_error: r.isError }];
    });
    messages.push({ role: "user", content: results });
  }
  throw new Error("The guide took too many steps to answer — try a narrower question.");
}
