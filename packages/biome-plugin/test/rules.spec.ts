import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PKG_DIR = resolve(import.meta.dirname, "..");

const FIXTURE_DIR = resolve(PKG_DIR, "test/fixtures");

function runBiome(target: string) {
  const { stdout, status } = spawnSync(
    "bunx",
    ["@biomejs/biome", "lint", "--reporter=json", target],
    { cwd: FIXTURE_DIR, encoding: "utf8" },
  );
  return { stdout: stdout ?? "", exitCode: status ?? -1 };
}

function writeBiome(target: string) {
  return spawnSync("bunx", ["@biomejs/biome", "check", "--write", target], {
    cwd: FIXTURE_DIR,
    encoding: "utf8",
  });
}

/** Runs `--write` on a throwaway copy of `source` and returns the rewritten text. */
function afterSafeFix(source: string, target: string): string {
  const path = resolve(FIXTURE_DIR, target);
  writeFileSync(path, source);
  try {
    writeBiome(target);
    return readFileSync(path, "utf8");
  } finally {
    rmSync(path, { force: true });
  }
}

interface Diagnostic {
  message?: string;
  category?: string;
  severity?: string;
  location?: { path?: string };
}

interface Report {
  diagnostics?: Diagnostic[];
}

function diagnosticsFor(target: string): Diagnostic[] {
  const { stdout } = runBiome(target);
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) return [];
  const report = JSON.parse(stdout.slice(jsonStart)) as Report;
  return report.diagnostics ?? [];
}

const messageOf = (d: Diagnostic) => d.message ?? "";

describe("no-promise-result", () => {
  test("flags Promise<Result<…>> in return type and interface", () => {
    const diags = diagnosticsFor("invalid/promise-result.ts");
    expect(diags.some((d) => messageOf(d).includes("Promise<Result<…>>"))).toBe(true);
  });
});

describe("no-unsafe-unwrap", () => {
  test("flags _unsafeUnwrap and _unsafeUnwrapErr calls", () => {
    const diags = diagnosticsFor("invalid/unsafe-unwrap.ts");
    expect(diags.some((d) => messageOf(d).includes("Avoid _unsafeUnwrap*"))).toBe(true);
  });
});

describe("no-deprecated-synonyms", () => {
  test("flags deprecated synonyms and methods", () => {
    const diags = diagnosticsFor("invalid/deprecated-synonyms.ts");
    expect(diags.some((d) => messageOf(d).includes("Avoid deprecated onrails synonyms"))).toBe(true);
  });
});

describe("fluent-stays-local", () => {
  test("flags FluentResult/FluentMaybe escaping as return type or stored field", () => {
    const diags = diagnosticsFor("invalid/fluent-escape.ts");
    expect(diags.some((d) => messageOf(d).includes("FluentResult/FluentMaybe must stay local"))).toBe(true);
  });
});

describe("exemptions", () => {
  test("ResultAsync return types produce no diagnostics", () => {
    const diags = diagnosticsFor("valid/result-async.ts");
    expect(diags).toEqual([]);
  });

  test("same-named calls in a file with no @onrails module source are not flagged", () => {
    const diags = diagnosticsFor("valid/foreign-synonyms.ts");
    expect(diags).toEqual([]);
  });
});

describe("no-deprecated-synonyms fixes", () => {
  const onrailsImport = 'import type { Result } from "@onrails/result";\n';

  test("rewrites .chain() to .flatMap() as a safe fix", () => {
    const source = `${onrailsImport}declare const r: { chain(fn: (v: unknown) => unknown): unknown };\nexport const a = r.chain(() => {});\n`;
    expect(afterSafeFix(source, "invalid/fix-chain.tmp.ts")).toContain("r.flatMap(() => {})");
  });

  test("leaves the free-function renames alone without --unsafe", () => {
    const source = `${onrailsImport}declare const collect: (a: unknown) => unknown;\nexport const a = collect([]);\n`;
    expect(afterSafeFix(source, "invalid/fix-collect.tmp.ts")).toContain("collect([])");
  });
});
