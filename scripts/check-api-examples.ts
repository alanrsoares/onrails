#!/usr/bin/env bun
/**
 * Compile-check every JSDoc `@example` on the public API of @onrails/result,
 * @onrails/maybe, and @onrails/pattern against the real source.
 *
 * The API-reference pages (apps/docs/content/docs/api/*.mdx) are generated from
 * these `@example` tags, but the examples are illustrative fragments — they
 * reference the API by bare name and use undeclared context vars (`api`, `id`,
 * `NetworkError`, …). So a naive compile drowns in "Cannot find name" noise.
 *
 * Strategy, per example:
 *   1. Import the API names that textually appear from the package.
 *   2. Compile; for each unresolved-name diagnostic, declare that name as
 *      `const X: any` + `type X = any` (covers value and type positions) and
 *      recompile. Loop until the only thing left is real diagnostics.
 *   3. Whatever remains is drift: a renamed/removed export, or a method chain
 *      that no longer type-checks against the real return type.
 *
 * Limitation: inputs stubbed as `any` mean pure argument-type drift on a stubbed
 * value isn't caught — but export existence and method-chain drift on real
 * return types are. This is a guardrail against the common rot (a signature or
 * name changing out from under an example), not a full type proof.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { extractExports } from "@onrails/docgen";
import { isErr } from "@onrails/result";
import ts from "typescript";

const REPO_ROOT = resolve(import.meta.dirname, "..");

const PACKAGES = [
  { entry: "packages/result/src/index.ts", name: "@onrails/result" },
  { entry: "packages/maybe/src/index.ts", name: "@onrails/maybe" },
  { entry: "packages/pattern/src/index.ts", name: "@onrails/pattern" },
] as const;

// Same source mapping the docs twoslash pipeline uses, so examples check against
// src (not built dist) and never go stale.
const PATHS: ts.MapLike<string[]> = {
  "@onrails/result": ["packages/result/src/index.ts"],
  "@onrails/result/*": ["packages/result/src/*"],
  "@onrails/maybe": ["packages/maybe/src/index.ts"],
  "@onrails/maybe/*": ["packages/maybe/src/*"],
  "@onrails/pattern": ["packages/pattern/src/index.ts"],
  "@onrails/pattern/*": ["packages/pattern/src/*"],
};

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  // No DOM lib: these packages are runtime-agnostic, so an example that names a
  // DOM global (e.g. a user type `Event`) means a user type — let it stub to
  // `any` instead of resolving to lib.dom and producing false mismatches.
  lib: ["lib.esnext.d.ts"],
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  baseUrl: REPO_ROOT,
  paths: PATHS,
};

const UNRESOLVED_CODES = new Set([2304, 2552, 2584]); // "Cannot find name 'X'"
// Artifacts of stubbing context vars as `any` in isolation: generic inference
// over an `any` argument collapses the Ok/Err type to `unknown`, so downstream
// member access reports these; a callback whose param type came from a stub is
// an implicit `any` (7006). They are noise, not API drift — suppress them.
const NOISE_CODES = new Set([18046, 18047, 18048, 2571, 2531, 2532, 2533, 7006]);
const MAX_STUB_ROUNDS = 8;

const stripFence = (raw: string): string =>
  raw
    .replace(/^\s*```[\w-]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();

const unresolvedName = (d: ts.Diagnostic): string | null => {
  if (!UNRESOLVED_CODES.has(d.code)) return null;
  const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  return /Cannot find name '([^']+)'/.exec(msg)?.[1] ?? null;
};

// Identifier boundary that respects `$` and `_` (JS `\b` treats `$` as a
// non-word char, so a plain `\bX\b` never matches the `$` export).
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const usesIdentifier = (body: string, name: string): boolean =>
  new RegExp(`(?<![\\w$])${escapeRe(name)}(?![\\w$])`).test(body);

const stubsOf = (stubs: ReadonlySet<string>): string =>
  [...stubs].map((s) => `declare const ${s}: any;\ntype ${s} = any;`).join("\n");

const buildModule = (
  body: string,
  pkgName: string,
  pkgExports: readonly string[],
  stubs: ReadonlySet<string>,
): string => {
  // A self-contained example brings its own imports — compile it verbatim (only
  // adding stubs for any context vars), don't auto-import or wrap.
  if (/^\s*import\b/m.test(body)) {
    return `${stubsOf(stubs)}\n${body}\n`;
  }
  const used = pkgExports.filter((n) => !stubs.has(n) && usesIdentifier(body, n));
  const importLine = used.length ? `import { ${used.join(", ")} } from "${pkgName}";\n` : "";
  // Wrap the body so fragment-style examples (a top-level `return`, a top-level
  // `await`) are valid; stubs/imports stay at module scope.
  return `${importLine}${stubsOf(stubs)}\nasync function __example__() {\n${body}\n}\nvoid __example__;\n`;
};

type Example = { symbol: string; index: number; body: string; pkgName: string };

const collectExamples = (): Example[] => {
  const out: Example[] = [];
  for (const pkg of PACKAGES) {
    const extracted = extractExports(pkg.entry, pkg.name, () => "Core");
    if (isErr(extracted)) {
      console.error(`failed to parse ${pkg.name}: ${extracted.error.message}`);
      process.exit(1);
    }
    for (const sym of extracted.value) {
      sym.examples.forEach((raw, i) => {
        const body = stripFence(raw);
        if (body) out.push({ symbol: sym.name, index: i, body, pkgName: pkg.name });
      });
    }
  }
  return out;
};

const exportNames = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const pkg of PACKAGES) {
    const extracted = extractExports(pkg.entry, pkg.name, () => "Core");
    if (isErr(extracted)) continue;
    // base names only (drop `ResultAsync.fromPromise` member rows -> `ResultAsync`)
    const names = new Set<string>();
    for (const s of extracted.value) names.add(s.name.split(".")[0] ?? s.name);
    map.set(pkg.name, [...names]);
  }
  return map;
};

const main = () => {
  const examples = collectExamples();
  const exportsByPkg = exportNames();
  const tmp = mkdtempSync(join(tmpdir(), "onrails-examples-"));

  // Resolve the final stub set per example by iterating the compiler until the
  // only unresolved names left are ones we've already declared.
  type Built = { ex: Example; file: string; stubs: Set<string> };
  const built: Built[] = examples.map((ex, i) => ({
    ex,
    file: join(tmp, `ex_${i}.ts`),
    stubs: new Set<string>(),
  }));

  const exportsFor = (b: Built) => exportsByPkg.get(b.ex.pkgName) ?? [];

  const writeAll = () => {
    for (const b of built) {
      writeFileSync(b.file, buildModule(b.ex.body, b.ex.pkgName, exportsFor(b), b.stubs));
    }
  };

  const compile = () => {
    writeAll();
    const program = ts.createProgram(
      built.map((b) => b.file),
      COMPILER_OPTIONS,
    );
    const byFile = new Map<string, ts.Diagnostic[]>();
    for (const d of ts.getPreEmitDiagnostics(program)) {
      const f = d.file?.fileName;
      if (!f) continue;
      const list = byFile.get(f) ?? [];
      list.push(d);
      byFile.set(f, list);
    }
    return byFile;
  };

  for (let round = 0; round < MAX_STUB_ROUNDS; round++) {
    const byFile = compile();
    let added = false;
    for (const b of built) {
      for (const d of byFile.get(b.file) ?? []) {
        const name = unresolvedName(d);
        if (name && !b.stubs.has(name)) {
          b.stubs.add(name);
          added = true;
        }
      }
    }
    if (!added) break;
  }

  const finalByFile = compile();
  const failures: { ex: Example; messages: string[] }[] = [];
  for (const b of built) {
    const diags = (finalByFile.get(b.file) ?? []).filter(
      (d) => unresolvedName(d) === null && !NOISE_CODES.has(d.code),
    );
    if (diags.length) {
      failures.push({
        ex: b.ex,
        messages: diags.map(
          (d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`,
        ),
      });
    }
  }

  rmSync(tmp, { recursive: true, force: true });

  const total = examples.length;
  console.log(`Checked ${total} @example snippet${total === 1 ? "" : "s"} across 3 packages.`);
  if (!failures.length) {
    console.log("All examples compile against the current API. ✓");
    return;
  }

  console.error(`\n${failures.length} example(s) no longer match the API:\n`);
  for (const f of failures) {
    console.error(`✗ ${f.ex.pkgName} › ${f.ex.symbol} (example #${f.ex.index + 1})`);
    for (const m of f.messages) console.error(`    ${m}`);
    console.error(`    ┌ snippet`);
    for (const line of f.ex.body.split("\n")) console.error(`    │ ${line}`);
    console.error(`    └`);
  }
  process.exit(1);
};

main();
