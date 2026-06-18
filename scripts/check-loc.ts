#!/usr/bin/env bun
/**
 * Per-file line-count guard. Biome has no whole-file LOC rule (only
 * `noExcessiveLinesPerFunction`), so this enforces it for `bun check` and the
 * pre-commit hook. Targets God-files/barrels, not cohesive small-function modules.
 */
import { Glob } from "bun";

const MAX_LINES = 500;

const PATTERNS = ["packages/*/src/**/*.ts", "packages/*/test/**/*.ts"] as const;

const isExcluded = (path: string): boolean =>
  path.endsWith(".d.ts") ||
  path.includes("/dist/") ||
  path.includes("/node_modules/") ||
  path.includes("/test/fixtures/");

const countLines = (text: string): number => {
  const n = text.split("\n").length;
  return text.endsWith("\n") ? n - 1 : n;
};

const seen = new Set<string>();
const offenders: { path: string; lines: number }[] = [];

for (const pattern of PATTERNS) {
  for await (const path of new Glob(pattern).scan(".")) {
    if (seen.has(path) || isExcluded(path)) continue;
    seen.add(path);
    const lines = countLines(await Bun.file(path).text());
    if (lines > MAX_LINES) offenders.push({ path, lines });
  }
}

if (offenders.length > 0) {
  offenders.sort((a, b) => b.lines - a.lines);
  console.error(`✖ ${offenders.length} file(s) exceed ${MAX_LINES} lines:\n`);
  for (const { path, lines } of offenders) {
    console.error(`  ${lines}\t${path}`);
  }
  console.error("\nSplit by responsibility; do not raise the cap to dodge.");
  process.exit(1);
}

console.log(`✓ all files within ${MAX_LINES} lines (${seen.size} checked)`);
