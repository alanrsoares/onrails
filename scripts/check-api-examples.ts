#!/usr/bin/env bun
/**
 * Compile-check every JSDoc `@example` on the public API of @onrails/result,
 * @onrails/maybe, and @onrails/pattern against the real source.
 *
 * The engine lives in `@onrails/docgen` (`checkExamples`); this script is just
 * the onrails configuration (which packages, source path mapping) and the
 * reporting/exit-code shell.
 */
import { resolve } from "node:path";
import { checkExamples } from "@onrails/docgen";
import { isErr } from "@onrails/result";

const REPO_ROOT = resolve(import.meta.dirname, "..");

const PACKAGES = [
  { entry: "packages/result/src/index.ts", name: "@onrails/result" },
  { entry: "packages/maybe/src/index.ts", name: "@onrails/maybe" },
  { entry: "packages/pattern/src/index.ts", name: "@onrails/pattern" },
] as const;

// Map specifiers to source (not built dist) so examples check against the live
// API and never go stale — the same mapping the docs twoslash pipeline uses.
const PATHS = {
  "@onrails/result": ["packages/result/src/index.ts"],
  "@onrails/result/*": ["packages/result/src/*"],
  "@onrails/maybe": ["packages/maybe/src/index.ts"],
  "@onrails/maybe/*": ["packages/maybe/src/*"],
  "@onrails/pattern": ["packages/pattern/src/index.ts"],
  "@onrails/pattern/*": ["packages/pattern/src/*"],
};

const result = checkExamples(PACKAGES, { baseUrl: REPO_ROOT, paths: PATHS });

if (isErr(result)) {
  console.error(result.error.message);
  process.exit(1);
}

const { total, packages, failures } = result.value;
console.log(`Checked ${total} @example snippet${total === 1 ? "" : "s"} across ${packages} packages.`);

if (!failures.length) {
  console.log("All examples compile against the current API. ✓");
} else {
  console.error(`\n${failures.length} example(s) no longer match the API:\n`);
  for (const f of failures) {
    console.error(`✗ ${f.pkgName} › ${f.symbol} (example #${f.index + 1})`);
    for (const m of f.messages) console.error(`    ${m}`);
    console.error("    ┌ snippet");
    for (const line of f.body.split("\n")) console.error(`    │ ${line}`);
    console.error("    └");
  }
  process.exit(1);
}
