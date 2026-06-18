#!/usr/bin/env bun
/**
 * onrails config for the `@onrails/docgen` snippet extractor.
 *
 * The engine is project-agnostic; this file holds only the onrails specifics:
 * where the example modules live, where the generated module goes, and how
 * relative source imports map to `@onrails/*` package specifiers.
 */
import { resolve } from "node:path";
import { extractSnippets } from "@onrails/docgen/snippets";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

// Rewrite `../../<pkg>/src/<rest>.js` -> `@onrails/<pkg>[/rest]`.
const rewriteOnrailsImport = (line: string): string =>
  line.replace(
    /from "(?:\.\.\/)+([\w-]+)\/src\/(.+?)\.js"/,
    (_m, pkg: string, rest: string) =>
      rest === "index" ? `from "@onrails/${pkg}"` : `from "@onrails/${pkg}/${rest}"`,
  );

const { count, outFile, skipped } = await extractSnippets({
  srcDir: resolve(REPO_ROOT, "packages/examples/src"),
  outFile: resolve(import.meta.dir, "../lib/snippets.generated.ts"),
  rewriteImport: rewriteOnrailsImport,
  sourceLabel: "packages/examples/src/*.ts",
  generatedBy: "scripts/gen-snippets.ts",
});

for (const name of skipped) console.warn(`skip ${name}.ts: no #region snippet`);
console.log(`Wrote ${count} snippets to ${outFile}`);
