/**
 * Date helpers + report aggregation (daily / weekly / monthly / session).
 */

function parseISO(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a Date in a timezone as YYYY-MM-DD */
export function dateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Monday-start ISO week key: YYYY-Www */
export function weekKey(date, timeZone) {
  // Use local calendar date in TZ, then compute ISO week on that Y-M-D as UTC noon
  const ymd = dateKey(date, timeZone);
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  // ISO week: Thursday determines the year
  const day = utc.getUTCDay() || 7; // Mon=1..Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  const weekYear = utc.getUTCFullYear();
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

export function monthKey(date, timeZone) {
  return dateKey(date, timeZone).slice(0, 7); // YYYY-MM
}

export function resolveTimezone(tz) {
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Filter records by inclusive date range (YYYY-MM-DD or YYYYMMDD).
 * Uses updatedAt (fallback createdAt).
 */
export function filterByDate(records, { since, until, timeZone } = {}) {
  const tz = resolveTimezone(timeZone);
  const norm = (s) => {
    if (!s) return null;
    const digits = String(s).replace(/-/g, "");
    if (!/^\d{8}$/.test(digits)) return null;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  };
  const sinceK = norm(since);
  const untilK = norm(until);

  return records.filter((r) => {
    const d = parseISO(r.updatedAt || r.createdAt);
    if (!d) return !sinceK && !untilK;
    const k = dateKey(d, tz);
    if (sinceK && k < sinceK) return false;
    if (untilK && k > untilK) return false;
    return true;
  });
}

function emptyBucket() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreateTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    peakTokens: 0,
    cost: 0,
    models: new Set(),
    sessions: 0,
  };
}

function addToBucket(b, r) {
  b.inputTokens += r.inputTokens;
  b.outputTokens += r.outputTokens;
  b.cacheCreateTokens += r.cacheCreateTokens;
  b.cacheReadTokens += r.cacheReadTokens;
  b.totalTokens += r.totalTokens;
  b.peakTokens += r.peakTokens;
  b.cost += r.cost;
  b.models.add(r.model);
  for (const m of r.models || []) b.models.add(m);
  b.sessions += 1;
}

function finalize(map) {
  return [...map.entries()]
    .map(([key, b]) => ({
      key,
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
      cacheCreateTokens: b.cacheCreateTokens,
      cacheReadTokens: b.cacheReadTokens,
      totalTokens: b.totalTokens,
      peakTokens: b.peakTokens,
      cost: b.cost,
      models: [...b.models].sort(),
      sessions: b.sessions,
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function aggregateBy(records, keyFn) {
  const map = new Map();
  for (const r of records) {
    const d = parseISO(r.updatedAt || r.createdAt);
    if (!d) continue;
    const key = keyFn(d, r);
    let b = map.get(key);
    if (!b) {
      b = emptyBucket();
      map.set(key, b);
    }
    addToBucket(b, r);
  }
  return finalize(map);
}

export function dailyReport(records, timeZone) {
  const tz = resolveTimezone(timeZone);
  return aggregateBy(records, (d) => dateKey(d, tz));
}

export function weeklyReport(records, timeZone) {
  const tz = resolveTimezone(timeZone);
  return aggregateBy(records, (d) => weekKey(d, tz));
}

export function monthlyReport(records, timeZone) {
  const tz = resolveTimezone(timeZone);
  return aggregateBy(records, (d) => monthKey(d, tz));
}

export function sessionReport(records, timeZone) {
  const tz = resolveTimezone(timeZone);
  return records
    .map((r) => {
      const d = parseISO(r.updatedAt || r.createdAt);
      return {
        key: r.sessionId,
        date: d ? dateKey(d, tz) : null,
        title: r.title,
        cwd: r.cwd,
        model: r.model,
        models: r.models,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        cacheCreateTokens: r.cacheCreateTokens,
        cacheReadTokens: r.cacheReadTokens,
        totalTokens: r.totalTokens,
        peakTokens: r.peakTokens,
        cost: r.cost,
        sessions: 1,
        prompts: r.prompts,
      };
    })
    .sort((a, b) => {
      const ad = a.date || "";
      const bd = b.date || "";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return a.key < b.key ? -1 : 1;
    });
}

export function totals(rows) {
  const t = emptyBucket();
  for (const r of rows) {
    t.inputTokens += r.inputTokens || 0;
    t.outputTokens += r.outputTokens || 0;
    t.cacheCreateTokens += r.cacheCreateTokens || 0;
    t.cacheReadTokens += r.cacheReadTokens || 0;
    t.totalTokens += r.totalTokens || 0;
    t.peakTokens += r.peakTokens || 0;
    t.cost += r.cost || 0;
    t.sessions += r.sessions || 0;
    for (const m of r.models || []) t.models.add(m);
    if (r.model) t.models.add(r.model);
  }
  return {
    inputTokens: t.inputTokens,
    outputTokens: t.outputTokens,
    cacheCreateTokens: t.cacheCreateTokens,
    cacheReadTokens: t.cacheReadTokens,
    totalTokens: t.totalTokens,
    peakTokens: t.peakTokens,
    cost: t.cost,
    models: [...t.models].sort(),
    sessions: t.sessions,
  };
}
