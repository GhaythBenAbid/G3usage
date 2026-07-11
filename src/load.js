import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { estimateCost } from "./pricing.js";

export function grokHome() {
  return process.env.GROK_HOME || path.join(os.homedir(), ".grok");
}

export function sessionsRoot(home = grokHome()) {
  return path.join(home, "sessions");
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Parse updates.jsonl for per-prompt token estimates.
 *
 * Grok exposes cumulative context size as `_meta.totalTokens`, not billed
 * input/output. We approximate:
 *   - input  ≈ first totalTokens observed in a prompt (context at turn start)
 *   - output ≈ max(0, peak - first) within that prompt (growth during the turn)
 *
 * Growth includes tool results, so "output" is an upper-bound estimate.
 */
function parseUpdates(updatesPath) {
  if (!fs.existsSync(updatesPath)) {
    return { inputTokens: 0, outputTokens: 0, peakTokens: 0, prompts: 0 };
  }

  /** @type {Map<string, { first: number, peak: number }>} */
  const byPrompt = new Map();
  let peakTokens = 0;
  let lineNo = 0;

  const text = fs.readFileSync(updatesPath, "utf8");
  for (const line of text.split("\n")) {
    lineNo++;
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const meta = o?.params?._meta;
    if (!meta || typeof meta.totalTokens !== "number") continue;

    const tt = meta.totalTokens;
    if (tt > peakTokens) peakTokens = tt;

    const pid = meta.promptId || `_line_${lineNo}`;
    let entry = byPrompt.get(pid);
    if (!entry) {
      // first observation for this turn (chronological — file is append-only)
      entry = { first: tt, peak: tt };
      byPrompt.set(pid, entry);
    } else if (tt > entry.peak) {
      entry.peak = tt;
    }
  }

  let inputTokens = 0;
  let outputTokens = 0;
  for (const { first, peak } of byPrompt.values()) {
    inputTokens += first;
    outputTokens += Math.max(0, peak - first);
  }

  return {
    inputTokens,
    outputTokens,
    peakTokens,
    prompts: byPrompt.size,
  };
}

function listSessionDirs(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const project of fs.readdirSync(root, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const projectPath = path.join(root, project.name);
    for (const sid of fs.readdirSync(projectPath, { withFileTypes: true })) {
      if (!sid.isDirectory()) continue;
      out.push(path.join(projectPath, sid.name));
    }
  }
  return out;
}

/**
 * @typedef {object} UsageRecord
 * @property {string} sessionId
 * @property {string|null} cwd
 * @property {string|null} title
 * @property {string} model
 * @property {string[]} models
 * @property {string|null} createdAt ISO
 * @property {string|null} updatedAt ISO
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} cacheReadTokens always 0 for now (not in local logs)
 * @property {number} cacheCreateTokens always 0
 * @property {number} totalTokens input+output estimate
 * @property {number} peakTokens max context size in session
 * @property {number} cost USD estimate
 * @property {string|null} agentName
 * @property {number} prompts
 */

/** @returns {UsageRecord[]} */
export function loadSessions({ home = grokHome() } = {}) {
  const root = sessionsRoot(home);
  const dirs = listSessionDirs(root);
  /** @type {UsageRecord[]} */
  const records = [];

  for (const dir of dirs) {
    const summary = readJson(path.join(dir, "summary.json")) || {};
    const signals = readJson(path.join(dir, "signals.json")) || {};
    const usage = parseUpdates(path.join(dir, "updates.jsonl"));

    // Prefer signals peak when updates empty/missing
    const peakTokens = Math.max(
      usage.peakTokens,
      signals.contextTokensUsed || 0,
    );

    const models = new Set();
    if (Array.isArray(signals.modelsUsed)) {
      for (const m of signals.modelsUsed) if (m) models.add(m);
    }
    if (signals.primaryModelId) models.add(signals.primaryModelId);
    if (summary.current_model_id) models.add(summary.current_model_id);

    const model =
      signals.primaryModelId ||
      summary.current_model_id ||
      [...models][0] ||
      "unknown";

    // If no prompt breakdown, fall back to peak as "total" with no split
    let { inputTokens, outputTokens, prompts } = usage;
    if (prompts === 0 && peakTokens > 0) {
      // unknown split — attribute all to input (context snapshot)
      inputTokens = peakTokens;
      outputTokens = 0;
    }

    const totalTokens = inputTokens + outputTokens;
    const cost = estimateCost(model, {
      input: inputTokens,
      output: outputTokens,
    });

    const sessionId =
      summary?.info?.id || path.basename(dir);

    const createdAt =
      summary.created_at || summary.updated_at || null;
    const updatedAt =
      summary.last_active_at || summary.updated_at || createdAt;

    // Skip empty ghost sessions
    if (totalTokens === 0 && peakTokens === 0 && !summary.num_messages) {
      continue;
    }

    records.push({
      sessionId,
      cwd: summary?.info?.cwd || null,
      title:
        summary.generated_title ||
        summary.session_summary ||
        null,
      model,
      models: [...models],
      createdAt,
      updatedAt,
      inputTokens,
      outputTokens,
      cacheReadTokens: 0,
      cacheCreateTokens: 0,
      totalTokens,
      peakTokens,
      cost,
      agentName: summary.agent_name || null,
      prompts,
    });
  }

  return records;
}
