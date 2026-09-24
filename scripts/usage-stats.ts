// How much Claude went into this game: the token usage of every Claude Code
// transcript that worked on it, plus a few git facts, written to
// src/content/usage-stats.json for the credits. Aggregates only (no paths,
// prompts or contents), so the file is safe to commit and publish.
//
//   bun scripts/usage-stats.ts   (also run by `bun run build`)
//
// Transcripts: ~/.claude/projects/<this repo's path, encoded>/**.jsonl
// (main sessions and their subagents), the sibling gamebones project's
// transcripts that mention this repo (where the game was set up), and the
// task outputs under the temp dir when they exist. A message streamed over
// several lines is counted once (by message id and request id), with its
// final output count. With no transcripts found (another machine, CI) the
// existing file is left as it is.

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src/content/usage-stats.json");
const name = basename(root);

/** Claude Code's folder name for a project path: every non-alphanumeric character becomes "-". */
const encode = (p: string): string => p.replace(/[^A-Za-z0-9]/g, "-");

/** List prices per million tokens: input, output, cache read (writes are 1.25x input for 5 min, 2x for 1 h). */
const PRICES: Record<string, [number, number, number]> = {
  "claude-opus-5-5": [4, 20, 0.2],
  "claude-opus-5": [5, 25, 0.5],
  "claude-fable-5-1": [10, 50, 0.25],
  "claude-fable-5": [10, 50, 1],
  "claude-sonnet-5": [2, 10, 0.2],
  "claude-haiku-4-5": [1, 5, 0.1],
};

function walk(dir: string, ext: string, found: string[] = []): string[] {
  if (!existsSync(dir)) return found;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, ext, found);
    else if (p.endsWith(ext)) found.push(p);
  }
  return found;
}

const projects = join(homedir(), ".claude", "projects");
const own = walk(join(projects, encode(root)), ".jsonl");
const kernel = walk(join(projects, encode(resolve(root, "../gamebones"))), ".jsonl").filter((f) => readFileSync(f, "utf8").includes(name));
const tasks = walk(join(tmpdir(), "claude", encode(root)), ".output");
const files = [...own, ...kernel, ...tasks];

if (!own.length) {
  console.log(`usage-stats: no transcripts for ${name} on this machine; ${out} left as it is`);
  process.exit(0);
}

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}
interface Call {
  model: string;
  u: Usage;
  out: number;
}

const calls = new Map<string, Call>();
const agents = new Set<string>();
let first = "";
let last = "";
for (const f of files) {
  if (basename(f).startsWith("agent-")) agents.add(basename(f));
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.includes('"usage"')) continue;
    let e: { message?: { id?: string; model?: string; usage?: Usage }; requestId?: string; timestamp?: string };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const m = e.message;
    if (!m?.usage || !m.id || !m.model || m.model.startsWith("<")) continue;
    const key = `${m.id}:${e.requestId}`;
    const seen = calls.get(key);
    const o = m.usage.output_tokens ?? 0;
    if (seen) seen.out = Math.max(seen.out, o);
    else calls.set(key, { model: m.model, u: m.usage, out: o });
    if (e.timestamp) {
      if (!first || e.timestamp < first) first = e.timestamp;
      if (e.timestamp > last) last = e.timestamp;
    }
  }
}

const tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
const outputByModel: Record<string, number> = {};
let cost = 0;
for (const c of calls.values()) {
  const cw = c.u.cache_creation_input_tokens ?? 0;
  const cw1h = c.u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  tokens.input += c.u.input_tokens ?? 0;
  tokens.output += c.out;
  tokens.cacheWrite += cw;
  tokens.cacheRead += c.u.cache_read_input_tokens ?? 0;
  outputByModel[c.model] = (outputByModel[c.model] ?? 0) + c.out;
  const [pi, po, pr] = PRICES[c.model] ?? PRICES["claude-opus-5-5"]!;
  cost += ((c.u.input_tokens ?? 0) * pi + c.out * po + (cw - cw1h) * pi * 1.25 + cw1h * pi * 2 + (c.u.cache_read_input_tokens ?? 0) * pr) / 1e6;
}

const git = (cmd: string): string => execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" }).trim();
const tracked = git("ls-files src test scripts").split("\n").filter((f) => /\.(ts|vue|css|mjs)$/.test(f));
let lines = 0;
for (const f of tracked) if (existsSync(join(root, f))) lines += readFileSync(join(root, f), "utf8").split("\n").length;
const dates = git("log --format=%aI").split("\n");

const stats = {
  generatedAt: new Date().toLocaleDateString("sv"),
  claude: {
    sessions: [...own, ...kernel].filter((f) => !basename(f).startsWith("agent-")).length,
    agents: agents.size,
    apiCalls: calls.size,
    tokens: { ...tokens, total: tokens.input + tokens.output + tokens.cacheWrite + tokens.cacheRead },
    outputByModel,
    costUsd: Math.round(cost),
    from: first,
    to: last,
    hours: first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 36e5) : 0,
  },
  git: {
    commits: dates.length,
    firstCommit: dates.at(-1) ?? "",
    lastCommit: dates[0] ?? "",
    files: tracked.length,
    lines,
  },
};

writeFileSync(out, `${JSON.stringify(stats, null, 2)}\n`);
console.log(`usage-stats: ${stats.claude.tokens.total.toLocaleString("en")} tokens over ${stats.claude.apiCalls} calls by ${stats.claude.agents} agents -> ${out}`);
