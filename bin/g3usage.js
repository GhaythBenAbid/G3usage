#!/usr/bin/env node
/**
 * Works with Node.js (npx / npm) and Bun (bunx / bun run).
 * Bun is a Node-compatible runtime — same entry point, zero deps.
 */
import { main } from "../src/cli.js";

main(process.argv.slice(2)).catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
