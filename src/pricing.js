/**
 * Token pricing ($ / 1M tokens) for API-equivalent cost estimates.
 *
 * Sources:
 * - xAI API: https://docs.x.ai/developers/pricing
 * - Cursor Composer 2.5: https://cursor.com/blog/composer-2-5
 *   and https://cursor.com/docs/models/cursor-composer-2-5
 * - Cursor model table: https://cursor.com/docs/models-and-pricing
 *
 * SuperGrok / subscription sessions may not bill per token —
 * reported costs are API-equivalent estimates only.
 */
export const PRICING = {
  // xAI Chat API — https://docs.x.ai/developers/pricing
  "grok-4.5": { input: 2.0, cachedInput: 0.5, output: 6.0 },
  "grok-4.3": { input: 1.25, cachedInput: 0.2, output: 2.5 },
  "grok-4.20-multi-agent-0309": { input: 1.25, cachedInput: 0.2, output: 2.5 },
  "grok-4.20-0309-reasoning": { input: 1.25, cachedInput: 0.2, output: 2.5 },
  "grok-4.20-0309-non-reasoning": { input: 1.25, cachedInput: 0.2, output: 2.5 },
  "grok-4": { input: 3.0, cachedInput: 0.75, output: 15.0 },
  "grok-4-0709": { input: 3.0, cachedInput: 0.75, output: 15.0 },
  "grok-4-fast": { input: 0.2, cachedInput: 0.05, output: 0.5 },
  "grok-4-1-fast": { input: 0.2, cachedInput: 0.05, output: 0.5 },
  "grok-code-fast-1": { input: 0.2, cachedInput: 0.05, output: 1.5 },
  "grok-3": { input: 3.0, cachedInput: 0.75, output: 15.0 },
  "grok-3-mini": { input: 0.3, cachedInput: 0.075, output: 0.5 },

  // xAI Code API
  "grok-build-0.1": { input: 1.0, cachedInput: 0.2, output: 2.0 },
  // Build UI alias often maps to 4.5 / grok-build-latest
  "grok-build": { input: 2.0, cachedInput: 0.5, output: 6.0 },
  "grok-build-latest": { input: 2.0, cachedInput: 0.5, output: 6.0 },

  // Cursor Composer 2.5 (also used inside Grok Build as grok-composer-*)
  // Standard: $0.50 in / $2.50 out; Fast (default): $3 in / $15 out
  "composer-2.5": { input: 0.5, cachedInput: 0.2, output: 2.5 },
  "composer-2.5-fast": { input: 3.0, cachedInput: 0.5, output: 15.0 },
  "grok-composer-2.5": { input: 0.5, cachedInput: 0.2, output: 2.5 },
  "grok-composer-2.5-fast": { input: 3.0, cachedInput: 0.5, output: 15.0 },
};

const DEFAULT = { input: 2.0, cachedInput: 0.5, output: 6.0 };

export function priceFor(model) {
  if (!model) return DEFAULT;
  if (PRICING[model]) return PRICING[model];

  const lower = String(model).toLowerCase();

  // Prefer exact-ish substring matches for composer variants before generic prefixes
  if (lower.includes("composer-2.5-fast") || lower.includes("composer-2.5_fast")) {
    return PRICING["composer-2.5-fast"];
  }
  if (lower.includes("composer-2.5") || lower.includes("composer_2.5")) {
    return PRICING["composer-2.5"];
  }

  // fuzzy: match prefix keys longest-first
  const keys = Object.keys(PRICING).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (model === k || model.startsWith(k) || k.startsWith(model)) {
      return PRICING[k];
    }
  }
  return DEFAULT;
}

/** Estimate USD cost from token counts. */
export function estimateCost(model, { input = 0, output = 0, cacheRead = 0 } = {}) {
  const p = priceFor(model);
  return (input * p.input + output * p.output + cacheRead * p.cachedInput) / 1_000_000;
}
