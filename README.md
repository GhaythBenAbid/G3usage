<div align="center">

<img src="assets/logo.png" alt="G3usage" width="180" />

# <img src="assets/icon.png" alt="" width="42" height="42" align="absmiddle" /> G3usage

### ccusage — but for **Grok Build**

<p>
  <img src="assets/icon-64.png" alt="" width="20" height="20" align="absmiddle" />
  &nbsp;<strong>npm package</strong>
  <code><a href="https://www.npmjs.com/package/g3usage">g3usage</a></code>
</p>

Local CLI that turns your `~/.grok` session logs into **daily / weekly / monthly / session** reports with estimated tokens & API-equivalent cost.

<br />

[![npm version](https://img.shields.io/npm/v/g3usage?color=111827&labelColor=f9fafb&style=for-the-badge)](https://www.npmjs.com/package/g3usage)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)
[![Zero deps](https://img.shields.io/badge/dependencies-0-success?style=for-the-badge)](#-features)

<br />

```bash
npx g3usage@latest
```

</div>

---

## Why G3usage?

If you use [Grok Build](https://x.ai/build) heavily, you eventually want the same visibility [ccusage](https://github.com/ccusage/ccusage) gives Claude / Codex users:

| Question | G3usage answer |
|----------|----------------|
| How many tokens did I burn this week? | `g3usage weekly` |
| Which days were expensive? | `g3usage daily` |
| Which session ate my context? | `g3usage session` |
| What would this cost on the public API? | Cost column (API-equivalent) |
| Does any of this leave my machine? | **No** — 100% local |

---

## Features

- **Local only** — reads `~/.grok/sessions`, never uploads usage
- **ccusage-style reports** — `daily` · `weekly` · `monthly` · `session`
- **JSON export** — pipe into scripts, dashboards, Notion, whatever
- **Date filters & timezones** — `--since` / `--until` / `--timezone`
- **Model-aware pricing** — Grok 4.5, Composer 2.5 Fast/Standard, grok-build, …
- **Zero runtime dependencies** — single small npm package (~10 KB)
- **One-liner install** — `npx g3usage@latest`

---

## Quick start

### Run without installing

```bash
npx g3usage@latest
npx g3usage@latest daily
npx g3usage@latest monthly
npx g3usage@latest session --json
```

### Install globally

```bash
npm install -g g3usage

g3usage
g3usage weekly
g3usage session -s 2026-03-01
```

### From source

```bash
git clone https://github.com/GhaythBenAbid/g3usage.git
cd g3usage
node bin/g3usage.js daily
```

Requires **Node.js 18+**.

---

## Example output

_Sample only — dummy numbers, not real usage._

```text
╭───────────────────────────────────────────────────────────╮
│ Grok Build Usage Report - Daily                           │
╰───────────────────────────────────────────────────────────╯

┌────────────┬──────────────────────────────────┬───────────┬──────────┬───────────┬──────────┬────────────┐
│ Date       │ Models                           │     Input │   Output │     Total │ Sessions │ Cost (USD) │
├────────────┼──────────────────────────────────┼───────────┼──────────┼───────────┼──────────┼────────────┤
│ 2026-03-12 │ grok-4.5                         │   412,500 │   88,200 │   500,700 │        4 │      $1.35 │
│ 2026-03-13 │ grok-4.5, grok-composer-2.5-fast │   980,000 │  210,000 │ 1,190,000 │        7 │      $5.12 │
│ 2026-03-14 │ grok-composer-2.5-fast           │   256,000 │   64,000 │   320,000 │        3 │      $1.73 │
├────────────┼──────────────────────────────────┼───────────┼──────────┼───────────┼──────────┼────────────┤
│ Total      │ grok-4.5, grok-composer-2.5-fast │ 1,648,500 │  362,200 │ 2,010,700 │       14 │      $8.20 │
└────────────┴──────────────────────────────────┴───────────┴──────────┴───────────┴──────────┴────────────┘

  Costs are API-equivalent estimates. SuperGrok / subscription usage may not bill per token.
  Input/Output estimated from cumulative context sizes in local session logs.
```

> Numbers above are **fake demo data** for the README. Run `npx g3usage@latest` to see your own local totals.

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `daily` | Group usage by calendar day **(default)** | `g3usage` or `g3usage daily` |
| `weekly` | Group by ISO week (`YYYY-Www`) | `g3usage weekly` |
| `monthly` | Group by month (`YYYY-MM`) | `g3usage monthly` |
| `session` | One row per Grok Build session | `g3usage session` |

### Options

| Flag | Description |
|------|-------------|
| `-j`, `--json` | Machine-readable JSON (great for scripts) |
| `-s`, `--since <date>` | Include from date (`YYYY-MM-DD` or `YYYYMMDD`) |
| `-u`, `--until <date>` | Include until date (inclusive) |
| `-z`, `--timezone <tz>` | IANA timezone for day/week/month boundaries (default: system) |
| `--no-cost` | Hide the cost column |
| `--path <dir>` | Override Grok home (default: `$GROK_HOME` or `~/.grok`) |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Print version |

### Recipes

```bash
# Last few days only
g3usage daily -s 2026-03-01 -u 2026-03-14

# Tokyo calendar days
g3usage daily -z Asia/Tokyo

# Export all sessions as JSON
g3usage session --json > sessions.json

# Tokens only, no dollar column
g3usage monthly --no-cost

# Custom Grok install location
g3usage --path /path/to/grok-home daily
```

---

## How it works

### Data source

G3usage walks:

```text
$GROK_HOME/sessions/<project>/<session-id>/
├── updates.jsonl    # live stream of session updates (+ totalTokens)
├── summary.json     # id, cwd, title, model, timestamps
└── signals.json     # models used, context peak, latency stats
```

Default home:

```text
~/.grok          # or $GROK_HOME if set
```

Nothing is sent to the network. Pricing tables are **bundled** in the package (not fetched live).

### Token estimation methodology

Grok Build currently records a **cumulative context size** as `_meta.totalTokens` on session updates — **not** a clean billed split of input / output / cache.

For each user turn (`promptId`), G3usage approximates:

| Metric | Formula | Meaning |
|--------|---------|---------|
| **Input** | first `totalTokens` in the turn | Context size when the turn starts |
| **Output** | `max(0, peak − first)` within the turn | How much the context grew during the turn |
| **Total** | input + output | Estimated tokens for reporting |

**Caveats (important):**

- Growth includes **tool results**, not only model generations → **output can be an upper bound**
- Compaction / rewinds can make curves non-monotonic
- Treat totals as **directional analytics**, not an invoice

### Cost estimation

Costs are **API-equivalent** using published rates (see `src/pricing.js`).

If you authenticate with **SuperGrok / X Premium+**, Grok Build is usually **subscription-based** — you may not pay these per-token rates. The cost column answers:

> “What would this usage roughly cost on public list prices?”

Not:

> “What will my card be charged?”

#### Pricing highlights (per 1M tokens)

| Model | Input | Cached input | Output | Source |
|-------|------:|-------------:|-------:|--------|
| `grok-4.5` | $2.00 | $0.50 | $6.00 | [xAI pricing](https://docs.x.ai/developers/pricing) |
| `grok-4.3` / `grok-4.20-*` | $1.25 | $0.20 | $2.50 | [xAI pricing](https://docs.x.ai/developers/pricing) |
| `grok-build-0.1` | $1.00 | $0.20 | $2.00 | [xAI Code API](https://docs.x.ai/developers/pricing) |
| `composer-2.5` / `grok-composer-2.5` | $0.50 | $0.20 | $2.50 | [Cursor Composer 2.5](https://cursor.com/blog/composer-2-5) |
| **`composer-2.5-fast` / `grok-composer-2.5-fast`** | **$3.00** | **$0.50** | **$15.00** | [Cursor docs](https://cursor.com/docs/models/cursor-composer-2-5) |

> **Fast is ~6× standard** Composer pricing. Fast is the default interactive tier in Cursor product docs — and matches the `*-fast` model ids in Grok Build logs.

Unknown models fall back to **Grok 4.5** rates (`$2 / $6`).

---

## JSON output

```bash
g3usage daily --json -s 2026-03-12
```

Shape (simplified):

```json
{
  "command": "daily",
  "timezone": "America/New_York",
  "grokHome": "/Users/you/.grok",
  "sessionsPath": "/Users/you/.grok/sessions",
  "totals": {
    "inputTokens": 412500,
    "outputTokens": 88200,
    "totalTokens": 500700,
    "cost": 1.35,
    "models": ["grok-4.5"],
    "sessions": 4
  },
  "rows": [
    {
      "key": "2026-03-12",
      "inputTokens": 412500,
      "outputTokens": 88200,
      "totalTokens": 500700,
      "cost": 1.35,
      "models": ["grok-4.5"],
      "sessions": 4
    }
  ]
}
```

Useful with `jq`:

```bash
g3usage monthly --json | jq '.totals'
g3usage session --json | jq '[.rows[] | {title, totalTokens, cost}]'
```

---

## Environment

| Variable | Purpose |
|----------|---------|
| `GROK_HOME` | Override Grok data directory (default `~/.grok`) |
| `NO_COLOR` | Disable ANSI colors |
| `FORCE_COLOR` | Force colors (when supported) |

---

## Project layout

```text
g3usage/
├── bin/g3usage.js      # CLI entry (npx / global bin)
├── src/
│   ├── cli.js          # commands, args, report wiring
│   ├── load.js         # parse ~/.grok/sessions
│   ├── aggregate.js    # daily / weekly / monthly / session
│   ├── pricing.js      # model → $/1M rates
│   └── table.js        # terminal tables (no deps)
├── package.json
└── README.md
```

---

## Comparison

| | [ccusage](https://github.com/ccusage/ccusage) | **G3usage** |
|--|-----------------------------------------------|-------------|
| Focus | Many coding agents (Claude, Codex, …) | **Grok Build only** |
| Data | Agent-specific local logs | `~/.grok/sessions` |
| Reports | daily / weekly / monthly / session / … | daily / weekly / monthly / session |
| Network | Optional pricing fetch | Fully offline pricing table |
| Runtime deps | Full CLI stack | **Zero** |

---

## Limitations & honesty

1. **No true I/O billing logs** in Grok Build yet → input/output are **estimates**
2. **Cache tokens** are not available in local logs → cache cost usually `$0` in reports
3. **Subscription users** should treat `$` as **API-equivalent**, not actual spend
4. **Tool-call fees** (web search, etc. on the public API) are **not** included
5. Pricing tables can drift — open a PR when xAI / Cursor change rates

---

## Contributing

PRs welcome — especially for:

- Better token math when Grok exposes real usage fields
- Pricing updates
- New report modes (e.g. by project path, by model only)
- Tests & CI

```bash
node bin/g3usage.js --help
node bin/g3usage.js daily --json | head
```

---

## Publish notes (maintainers)

```bash
npm login
npm publish --otp=<code>    # 2FA required
npm version patch && npm publish --otp=<code>
```

Users always get the latest with:

```bash
npx g3usage@latest
```

---

## License

[MIT](./LICENSE)

---

<div align="center">

**G3usage — built for people who live in the terminal with Grok.**

`npx g3usage@latest`

</div>
