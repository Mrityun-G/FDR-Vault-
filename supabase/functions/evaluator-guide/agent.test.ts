// Unit test for the Evaluator Guide agent with a fake Anthropic client (no network, no cost).
// Run: node supabase/functions/evaluator-guide/agent.test.ts   (Node 22.6+ strips the TS types)
import { answerQuestion, MAX_STEPS, MODEL, RefusedError, runTool, TOOLS } from "./agent.ts";

let failed = 0;
const ok = (cond: unknown, msg: string) => { console.log(`  ${cond ? "✓" : "✗"} ${msg}`); if (!cond) failed++; };

const corpus = {
  "app.js": "const a = 1;\nfunction submitApp() {\n  return rpc('submit_application');\n}\n",
  "supabase/migrations/001.sql": "create function public.submit_application() returns void as $$ begin end $$;\n-- RULE-FDR-CORPUS-07\n",
};

function fakeClient(script: any[]) {
  const calls: any[] = [];
  return { calls, beta: { messages: { create: async (req: any) => { calls.push(structuredClone(req)); const r = script.shift(); if (!r) throw new Error("script exhausted"); return r; } } } } as any;
}
const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });

console.log("\nrunTool");
{
  const s = new Set<string>();
  ok(runTool(corpus, "list_files", {}, s).text.includes("app.js (5 lines)"), "list_files lists paths with line counts");
  const hit = runTool(corpus, "search_code", { pattern: "submit_application" }, s);
  ok(hit.text.includes("app.js:3:") && hit.text.includes("supabase/migrations/001.sql:1:"), "search_code returns path:line matches across files");
  ok(runTool(corpus, "search_code", { pattern: "submit", path_prefix: "supabase/" }, new Set()).text.split("\n").every((l) => l.startsWith("supabase/")), "path_prefix narrows the search");
  ok(runTool(corpus, "search_code", { pattern: "(" }, s).isError, "invalid regex is a tool error, not a crash");
  ok(runTool(corpus, "search_code", {}, s).isError, "missing pattern is a tool error");
  const read = runTool(corpus, "read_file", { path: "app.js", start_line: 2, end_line: 3 }, s);
  ok(read.text === "2\tfunction submitApp() {\n3\t  return rpc('submit_application');\n(2 more lines)", "read_file returns numbered lines and says what is left");
  ok(runTool(corpus, "read_file", { path: "../etc/passwd" }, s).isError, "read_file only reads corpus paths");
  ok(runTool(corpus, "read_file", { path: "app.js", start_line: 99 }, s).isError, "start beyond the end is a tool error");
  ok(runTool(corpus, "nope", {}, s).isError, "unknown tool is a tool error");
  ok(s.has("app.js") && s.has("supabase/migrations/001.sql"), "files read or matched are recorded as sources");
}

console.log("\nanswerQuestion: tool loop");
{
  const client = fakeClient([
    { stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "sig" }, toolUse("t1", "search_code", { pattern: "submit_application" }), toolUse("t2", "list_files", {})] },
    { stop_reason: "tool_use", content: [toolUse("t3", "read_file", { path: "supabase/migrations/001.sql" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Submission runs in `submit_application` (`supabase/migrations/001.sql:1`)." }] },
  ]);
  const r = await answerQuestion(client, corpus, "README", "How is an application submitted?", [{ role: "assistant", text: "Namaste!" }, { role: "user", text: "hi" }, { role: "assistant", text: "Hello" }], { site: "inst", screen: "dashboard", signedIn: true });
  ok(r.answer.includes("submit_application") && r.steps === 3, "returns the final text after 3 model calls");
  ok(r.sources.includes("supabase/migrations/001.sql") && r.sources.includes("app.js"), "reports the files it consulted");
  const first = client.calls[0], last = client.calls[2];
  ok(first.model === MODEL && first.fallbacks === "default" && first.betas.includes("server-side-fallback-2026-07-01"), "uses claude-opus-5-5 with server-side fallback");
  ok(first.output_config.effort === "medium" && first.tools.length === TOOLS.length, "sets effort and the three tools");
  ok(first.system[1].cache_control?.type === "ephemeral" && first.system[1].text.includes("README"), "README is in the cached system prefix");
  ok(first.messages[0].role === "user" && first.messages[0].content === "hi", "history starts with a user turn (leading assistant greeting dropped)");
  ok(first.messages.at(-1).content.includes('screen "dashboard"') && first.messages.at(-1).content.includes("How is an application submitted?"), "page context travels with the question");
  const results = client.calls[1].messages.at(-1).content;
  ok(results.length === 2 && results[0].tool_use_id === "t1" && results[1].tool_use_id === "t2", "all tool results go back in one user message");
  ok(client.calls[1].messages.at(-2).content[0].type === "thinking", "assistant turn (incl. thinking) is passed back unchanged");
  ok(last.messages.at(-1).content[0].content.startsWith("1\tcreate function"), "read_file output reaches the model");
}

console.log("\nanswerQuestion: failures");
{
  try { await answerQuestion(fakeClient([{ stop_reason: "refusal", stop_details: { explanation: "declined" }, content: [] }]), corpus, "", "q"); ok(false, "refusal throws"); }
  catch (e) { ok(e instanceof RefusedError && (e as Error).message === "declined", "refusal raises RefusedError with the explanation"); }
  const loop = Array.from({ length: MAX_STEPS }, (_, i) => ({ stop_reason: "tool_use", content: [toolUse(`l${i}`, "list_files", {})] }));
  try { await answerQuestion(fakeClient(loop), corpus, "", "q"); ok(false, "endless tool use throws"); }
  catch (e) { ok((e as Error).message.includes("too many steps"), `stops after ${MAX_STEPS} model calls`); }
  try { await answerQuestion(fakeClient([{ stop_reason: "max_tokens", content: [] }]), corpus, "", "q"); ok(false, "empty cut-off throws"); }
  catch (e) { ok((e as Error).message.includes("cut off"), "an empty max_tokens reply is an error"); }
  const long = await answerQuestion(fakeClient([{ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] }]), corpus, "", "x".repeat(5000));
  ok(long.answer === "ok", "very long questions are truncated, not rejected, inside the agent");
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
