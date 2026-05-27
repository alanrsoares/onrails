import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const PKG_DIR = resolve(import.meta.dirname, "..");

function runBiome(target: string) {
  const { stdout, status } = spawnSync(
    "bunx",
    ["@biomejs/biome", "lint", "--reporter=json", target],
    { cwd: PKG_DIR, encoding: "utf8" },
  );
  return { stdout: stdout ?? "", exitCode: status ?? -1 };
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
    const diags = diagnosticsFor("fixtures/invalid/promise-result.ts");
    expect(diags.some((d) => messageOf(d).includes("Promise<Result<…>>"))).toBe(true);
  });
});

describe("no-unsafe-unwrap", () => {
  test("flags _unsafeUnwrap and _unsafeUnwrapErr calls", () => {
    const diags = diagnosticsFor("fixtures/invalid/unsafe-unwrap.ts");
    expect(diags.some((d) => messageOf(d).includes("_unsafeUnwrap"))).toBe(true);
  });
});

describe("exemptions", () => {
  test("ResultAsync return types produce no diagnostics", () => {
    const diags = diagnosticsFor("fixtures/valid/result-async.ts");
    expect(diags).toEqual([]);
  });
});
