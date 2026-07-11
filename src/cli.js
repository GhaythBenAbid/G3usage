import { loadSessions, grokHome, sessionsRoot } from "./load.js";
import {
  filterByDate,
  dailyReport,
  weeklyReport,
  monthlyReport,
  sessionReport,
  totals,
  resolveTimezone,
} from "./aggregate.js";
import {
  printTable,
  formatNum,
  formatCost,
  c,
} from "./table.js";

const VERSION = "0.1.0";

const HELP = `
${c.bold("g3usage")} — Grok Build usage analysis (ccusage for Grok)

${c.bold("USAGE")}
  g3usage [daily] [options]
  g3usage <command> [options]

${c.bold("COMMANDS")}
  daily      Show usage grouped by date (default)
  weekly     Show usage grouped by week
  monthly    Show usage grouped by month
  session    Show usage grouped by session

${c.bold("OPTIONS")}
  -j, --json              Output JSON
  -s, --since <date>      Filter from date (YYYY-MM-DD or YYYYMMDD)
  -u, --until <date>      Filter until date (inclusive)
  -z, --timezone <tz>     IANA timezone for date grouping
      --no-cost           Hide cost column
      --path <dir>        Override Grok home (default: $GROK_HOME or ~/.grok)
  -h, --help              Show help
  -v, --version           Show version

${c.bold("NOTES")}
  Reads local session logs from ~/.grok/sessions (never uploads data).
  Token input/output is estimated from cumulative context sizes in
  updates.jsonl — Grok does not currently log billed I/O splits.
  Cost is API-equivalent; SuperGrok subscription usage may not bill per token.
`.trim();

function parseArgs(argv) {
  const opts = {
    command: "daily",
    json: false,
    since: null,
    until: null,
    timezone: null,
    noCost: false,
    path: null,
    help: false,
    version: false,
  };

  const commands = new Set(["daily", "weekly", "monthly", "session"]);
  const args = [...argv];

  if (args[0] && !args[0].startsWith("-") && commands.has(args[0])) {
    opts.command = args.shift();
  }

  while (args.length) {
    const a = args.shift();
    switch (a) {
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "-v":
      case "--version":
        opts.version = true;
        break;
      case "-j":
      case "--json":
        opts.json = true;
        break;
      case "--no-cost":
        opts.noCost = true;
        break;
      case "-s":
      case "--since":
        opts.since = args.shift();
        break;
      case "-u":
      case "--until":
        opts.until = args.shift();
        break;
      case "-z":
      case "--timezone":
        opts.timezone = args.shift();
        break;
      case "--path":
        opts.path = args.shift();
        break;
      default:
        if (a.startsWith("-")) {
          throw new Error(`Unknown option: ${a}\n\n${HELP}`);
        }
        if (commands.has(a)) {
          opts.command = a;
        } else {
          throw new Error(`Unknown command: ${a}\n\n${HELP}`);
        }
    }
  }

  return opts;
}

function shortPath(p, max = 36) {
  if (!p) return "";
  const home = process.env.HOME || "";
  let s = home && p.startsWith(home) ? `~${p.slice(home.length)}` : p;
  if (s.length <= max) return s;
  return "…" + s.slice(-(max - 1));
}

function rowCells(row, { noCost, mode }) {
  const models =
    (row.models && row.models.length
      ? row.models
      : row.model
        ? [row.model]
        : []
    )
      .map((m) => m)
      .join(", ");

  if (mode === "session") {
    const label = row.title
      ? `${row.key.slice(0, 8)}… ${row.title.slice(0, 28)}`
      : row.key.slice(0, 13);
    const cells = [
      row.date || "?",
      label,
      models || "—",
      formatNum(row.inputTokens),
      formatNum(row.outputTokens),
      formatNum(row.totalTokens),
    ];
    if (!noCost) cells.push(formatCost(row.cost));
    return cells;
  }

  const cells = [
    row.key,
    models || "—",
    formatNum(row.inputTokens),
    formatNum(row.outputTokens),
    formatNum(row.totalTokens),
    String(row.sessions ?? ""),
  ];
  if (!noCost) cells.push(formatCost(row.cost));
  return cells;
}

function headersFor(mode, noCost) {
  if (mode === "session") {
    const h = ["Date", "Session", "Models", "Input", "Output", "Total"];
    if (!noCost) h.push("Cost (USD)");
    return h;
  }
  const label =
    mode === "monthly" ? "Month" : mode === "weekly" ? "Week" : "Date";
  const h = [label, "Models", "Input", "Output", "Total", "Sessions"];
  if (!noCost) h.push("Cost (USD)");
  return h;
}

function alignFor(mode, noCost) {
  if (mode === "session") {
    return ["left", "left", "left", "right", "right", "right", "right"].slice(
      0,
      noCost ? 6 : 7,
    );
  }
  return ["left", "left", "right", "right", "right", "right", "right"].slice(
    0,
    noCost ? 6 : 7,
  );
}

function printReport(mode, rows, opts) {
  const t = totals(rows);
  const titleMap = {
    daily: "Grok Build Usage Report - Daily",
    weekly: "Grok Build Usage Report - Weekly",
    monthly: "Grok Build Usage Report - Monthly",
    session: "Grok Build Usage Report - Session",
  };

  const headers = headersFor(mode, opts.noCost);
  const tableRows = rows.map((r) => rowCells(r, { noCost: opts.noCost, mode }));

  let footer;
  if (mode === "session") {
    footer = [
      "Total",
      `${t.sessions} sessions`,
      t.models.join(", "),
      formatNum(t.inputTokens),
      formatNum(t.outputTokens),
      formatNum(t.totalTokens),
    ];
    if (!opts.noCost) footer.push(formatCost(t.cost));
  } else {
    footer = [
      "Total",
      t.models.join(", "),
      formatNum(t.inputTokens),
      formatNum(t.outputTokens),
      formatNum(t.totalTokens),
      String(t.sessions),
    ];
    if (!opts.noCost) footer.push(formatCost(t.cost));
  }

  printTable({
    title: titleMap[mode],
    headers,
    rows: tableRows,
    align: alignFor(mode, opts.noCost),
    footer,
  });

  if (!opts.noCost) {
    console.log(
      c.dim(
        "  Costs are API-equivalent estimates. SuperGrok / subscription usage may not bill per token.",
      ),
    );
  }
  console.log(
    c.dim(
      "  Input/Output estimated from cumulative context sizes in local session logs.",
    ),
  );
  console.log();
}

export async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (opts.version) {
    console.log(`g3usage ${VERSION}`);
    return;
  }

  const home = opts.path || grokHome();
  const root = sessionsRoot(home);

  if (!opts.json) {
    // quiet load message only when empty later
  }

  let records = loadSessions({ home });
  const tz = resolveTimezone(opts.timezone);
  records = filterByDate(records, {
    since: opts.since,
    until: opts.until,
    timeZone: tz,
  });

  let rows;
  switch (opts.command) {
    case "weekly":
      rows = weeklyReport(records, tz);
      break;
    case "monthly":
      rows = monthlyReport(records, tz);
      break;
    case "session":
      rows = sessionReport(records, tz);
      break;
    case "daily":
    default:
      rows = dailyReport(records, tz);
  }

  if (opts.json) {
    const payload = {
      command: opts.command,
      timezone: tz,
      grokHome: home,
      sessionsPath: root,
      totals: totals(rows),
      rows,
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log(
      c.yellow(
        `\nNo Grok Build usage found under ${root}\n` +
          `Run some sessions with Grok Build first, or pass --path.\n`,
      ),
    );
    return;
  }

  printReport(opts.command, rows, opts);
}
