/** Minimal table renderer (no deps). */

const useColor =
  process.stdout.isTTY &&
  !process.env.NO_COLOR &&
  process.env.FORCE_COLOR !== "0";

const c = {
  bold: (s) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  cyan: (s) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
  green: (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
};

export function formatNum(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

export function formatCost(n) {
  if (n == null || Number.isNaN(n)) return "$0.00";
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function pad(str, width, align = "left") {
  const s = String(str);
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  const padLen = Math.max(0, width - visible.length);
  if (align === "right") return " ".repeat(padLen) + s;
  return s + " ".repeat(padLen);
}

function visibleLen(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, "").length;
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string[]} opts.headers
 * @param {string[][]} opts.rows
 * @param {('left'|'right')[]} [opts.align]
 * @param {string[]} [opts.footer]
 */
export function printTable({ title, headers, rows, align = [], footer }) {
  const cols = headers.length;
  const widths = headers.map((h, i) => {
    let w = visibleLen(h);
    for (const row of rows) w = Math.max(w, visibleLen(row[i] ?? ""));
    if (footer) w = Math.max(w, visibleLen(footer[i] ?? ""));
    return Math.min(w, 48);
  });

  const rule = (left, mid, right, fill = "─") =>
    left + widths.map((w) => fill.repeat(w + 2)).join(mid) + right;

  const line = (cells, bold = false) => {
    const parts = cells.map((cell, i) => {
      let text = String(cell ?? "");
      // truncate long cells
      const vis = visibleLen(text);
      if (vis > widths[i]) {
        const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
        text = plain.slice(0, Math.max(0, widths[i] - 1)) + "…";
      }
      const a = align[i] || (i === 0 ? "left" : "right");
      return pad(text, widths[i], a);
    });
    const body = "│ " + parts.join(" │ ") + " │";
    return bold ? c.bold(body) : body;
  };

  const boxTitle = title;
  const inner = Math.max(
    boxTitle.length + 2,
    widths.reduce((a, w) => a + w + 3, 1),
  );
  console.log();
  console.log(c.cyan("╭" + "─".repeat(inner) + "╮"));
  console.log(c.cyan("│") + c.bold(pad(` ${boxTitle}`, inner)) + c.cyan("│"));
  console.log(c.cyan("╰" + "─".repeat(inner) + "╯"));
  console.log();

  console.log(rule("┌", "┬", "┐"));
  console.log(line(headers, true));
  console.log(rule("├", "┼", "┤"));
  for (const row of rows) console.log(line(row));
  if (footer) {
    console.log(rule("├", "┼", "┤"));
    console.log(line(footer, true));
  }
  console.log(rule("└", "┴", "┘"));
  console.log();
}

export function modelsCell(models) {
  if (!models?.length) return "";
  return models.map((m) => `- ${m}`).join("\n");
}

export { c };
