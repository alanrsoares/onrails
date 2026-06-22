import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isErr, type Result, trySync } from "@onrails/result";
import ts from "typescript";
import { extractExports } from "./extract.js";
import { toError } from "./to-error.js";

/** A package whose public-API `@example` blocks should be compile-checked. */
export interface ExamplePackage {
  /** Entry source file (e.g. `packages/foo/src/index.ts`). */
  readonly entry: string;
  /** Bare module specifier examples import from (e.g. `@scope/foo`). */
  readonly name: string;
}

/** Options for {@link checkExamples}. */
export interface CheckExamplesOptions {
  /** Base directory the compiler resolves `paths` against (repo root). */
  readonly baseUrl: string;
  /**
   * Module path mapping so examples resolve against source (not built dist),
   * mirroring the docs twoslash pipeline. Keys are the bare specifiers used in
   * examples; values are source paths relative to `baseUrl`.
   */
  readonly paths: ts.MapLike<string[]>;
}

/** A single `@example` that no longer compiles against its API. */
export interface ExampleFailure {
  readonly pkgName: string;
  readonly symbol: string;
  /** Zero-based index of the failing example within the symbol. */
  readonly index: number;
  readonly body: string;
  readonly messages: readonly string[];
}

/** Outcome of {@link checkExamples}. */
export interface CheckReport {
  /** Total `@example` snippets checked. */
  readonly total: number;
  /** Number of packages parsed. */
  readonly packages: number;
  /** Examples that failed to compile (empty = all good). */
  readonly failures: readonly ExampleFailure[];
}

// "Cannot find name 'X'" — the names we resolve by stubbing.
const UNRESOLVED_CODES = new Set([2304, 2552, 2584]);
// Artifacts of stubbing context vars as `any` in isolation: generic inference
// over an `any` argument collapses return types to `unknown`, so downstream
// member access reports these; a callback whose param type came from a stub is
// an implicit `any` (7006). Noise, not API drift.
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
// non-word char, so a plain `\bX\b` never matches a `$`-named export).
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
  // adding stubs for context vars); don't auto-import or wrap.
  if (/^\s*import\b/m.test(body)) {
    return `${stubsOf(stubs)}\n${body}\n`;
  }
  const used = pkgExports.filter((n) => !stubs.has(n) && usesIdentifier(body, n));
  const importLine = used.length ? `import { ${used.join(", ")} } from "${pkgName}";\n` : "";
  // Wrap so fragment-style examples (top-level `return`/`await`) are valid;
  // stubs/imports stay at module scope.
  return `${importLine}${stubsOf(stubs)}\nasync function __example__() {\n${body}\n}\nvoid __example__;\n`;
};

type Example = { symbol: string; index: number; body: string; pkgName: string };
type Built = { ex: Example; file: string; stubs: Set<string>; exports: readonly string[] };
type Parsed = { examples: Example[]; exportsByPkg: Map<string, string[]> };

// Parse every package once: collect examples + base export names. Throws (caught
// by the outer trySync) if a package fails to parse.
const parsePackages = (packages: readonly ExamplePackage[]): Parsed => {
  const examples: Example[] = [];
  const exportsByPkg = new Map<string, string[]>();
  for (const pkg of packages) {
    const extracted = extractExports(pkg.entry, pkg.name, () => "Core");
    if (isErr(extracted)) {
      throw new Error(`failed to parse ${pkg.name}: ${extracted.error.message}`);
    }
    const names = new Set<string>();
    for (const sym of extracted.value) {
      // Base names only (drop `Foo.method` member rows -> `Foo`).
      names.add(sym.name.split(".")[0] ?? sym.name);
      sym.examples.forEach((raw, i) => {
        const body = stripFence(raw);
        if (body) examples.push({ symbol: sym.name, index: i, body, pkgName: pkg.name });
      });
    }
    exportsByPkg.set(pkg.name, [...names]);
  }
  return { examples, exportsByPkg };
};

const compileBuilt = (
  built: readonly Built[],
  compilerOptions: ts.CompilerOptions,
): Map<string, ts.Diagnostic[]> => {
  for (const b of built) {
    writeFileSync(b.file, buildModule(b.ex.body, b.ex.pkgName, b.exports, b.stubs));
  }
  const program = ts.createProgram(
    built.map((b) => b.file),
    compilerOptions,
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

// Recompile, declaring each newly unresolved name as `any`, until stable.
// Returns the final diagnostics, so the caller need not recompile.
const resolveStubs = (
  built: readonly Built[],
  compilerOptions: ts.CompilerOptions,
  maxRounds: number,
): Map<string, ts.Diagnostic[]> => {
  let byFile = compileBuilt(built, compilerOptions);
  for (let round = 0; round < maxRounds; round++) {
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
    byFile = compileBuilt(built, compilerOptions);
  }
  return byFile;
};

const collectFailures = (
  built: readonly Built[],
  byFile: Map<string, ts.Diagnostic[]>,
  noiseCodes: ReadonlySet<number>,
): ExampleFailure[] => {
  const failures: ExampleFailure[] = [];
  for (const b of built) {
    const diags = (byFile.get(b.file) ?? []).filter(
      (d) => unresolvedName(d) === null && !noiseCodes.has(d.code),
    );
    if (diags.length) {
      failures.push({
        pkgName: b.ex.pkgName,
        symbol: b.ex.symbol,
        index: b.ex.index,
        body: b.ex.body,
        messages: diags.map(
          (d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`,
        ),
      });
    }
  }
  return failures;
};

/**
 * Compile-check every JSDoc `@example` on each package's public API against the
 * real source. API-reference pages are generated from these `@example` tags,
 * but examples are illustrative fragments — they reference the API by bare name
 * and use undeclared context vars, so a naive compile drowns in "Cannot find
 * name" noise.
 *
 * Strategy, per example: import the API names that textually appear, then
 * iteratively declare each unresolved name as `const X: any` + `type X = any`
 * and recompile until only real diagnostics remain. Whatever is left is drift —
 * a renamed/removed export, or a method chain that no longer type-checks.
 *
 * Pure: returns a {@link CheckReport} (or `err` if a package fails to parse).
 * Reporting and process exit codes are left to the caller.
 *
 * @example
 * ```ts
 * const report = checkExamples(
 *   [{ entry: "packages/foo/src/index.ts", name: "@scope/foo" }],
 *   { baseUrl: process.cwd(), paths: { "@scope/foo": ["packages/foo/src/index.ts"], "@scope/foo/*": ["packages/foo/src/*"] } },
 * );
 * ```
 */
export const checkExamples = (
  packages: readonly ExamplePackage[],
  opts: CheckExamplesOptions,
): Result<CheckReport, Error> =>
  trySync((): CheckReport => {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      // No DOM lib: these packages are runtime-agnostic, so an example naming a
      // DOM global (e.g. a user type `Event`) stubs to `any` instead of
      // resolving to lib.dom and producing false mismatches.
      lib: ["lib.esnext.d.ts"],
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      baseUrl: opts.baseUrl,
      paths: opts.paths,
    };
    const { examples, exportsByPkg } = parsePackages(packages);

    const tmp = mkdtempSync(join(tmpdir(), "docgen-examples-"));
    try {
      const built: Built[] = examples.map((ex, i) => ({
        ex,
        file: join(tmp, `ex_${i}.ts`),
        stubs: new Set<string>(),
        exports: exportsByPkg.get(ex.pkgName) ?? [],
      }));

      const byFile = resolveStubs(built, compilerOptions, MAX_STUB_ROUNDS);
      const failures = collectFailures(built, byFile, NOISE_CODES);

      return { total: examples.length, packages: packages.length, failures };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, toError)();
