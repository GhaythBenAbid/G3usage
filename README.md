# g3usage

**ccusage for Grok Build** — analyze local Grok Build token usage and estimate costs.

## Quick start

```bash
npx g3usage@latest
```

Or install globally:

```bash
npm install -g g3usage
g3usage
g3usage monthly
g3usage session --json
```

From this repo (dev):

```bash
node bin/g3usage.js daily
```

## What it does

Reads **local** session logs from:

```
$GROK_HOME/sessions/*/*/   # default: ~/.grok/sessions/
```

For each session it uses:

| File | Role |
|------|------|
| `updates.jsonl` | `_meta.totalTokens` (cumulative context size per event) |
| `summary.json` | session id, cwd, title, model, timestamps |
| `signals.json` | models used, context peak fallback |

Nothing is uploaded. Same idea as [ccusage](https://github.com/ccusage/ccusage), scoped to Grok Build only.

## Commands

| Command | Description |
|---------|-------------|
| `daily` (default) | Group by date |
| `weekly` | Group by ISO week |
| `monthly` | Group by month |
| `session` | One row per session |

### Options

```
-j, --json              JSON output
-s, --since <date>      From date (YYYY-MM-DD or YYYYMMDD)
-u, --until <date>      Until date (inclusive)
-z, --timezone <tz>     IANA timezone for grouping
    --no-cost           Hide cost column
    --path <dir>        Grok home override (default ~/.grok)
-h, --help
-v, --version
```

## Token estimates

Grok Build currently logs **cumulative context size** (`totalTokens`), not billed input/output/cache splits.

g3usage estimates per user turn (`promptId`):

- **Input** ≈ first `totalTokens` seen in the turn (context at start)
- **Output** ≈ growth during the turn (`peak − first`)

Growth includes tool results, so output is an **upper-bound** estimate. Treat numbers as directional, not invoices.

## Cost estimates

Costs use public xAI API rates (see `src/pricing.js`). If you use **SuperGrok / X Premium+** subscription auth, you may not be billed per token — figures are **API-equivalent**.

## Install

```bash
npm install -g .
# then:
g3usage
g3usage session -s 2026-07-01
```

## License

MIT
