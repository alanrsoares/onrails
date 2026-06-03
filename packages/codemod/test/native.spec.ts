import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  collectNativeMigrationWarnings,
  rewriteCompatImportsToNative,
  rewriteCompatMethodChainsToNative,
} from "../src/index.js";

const cliPath = resolve(import.meta.dir, "../src/index.ts");

async function makeFixture(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "onrails-codemod-"));
}

async function writeFixtureFile(root: string, path: string, content: string): Promise<void> {
  const fullPath = join(root, path);
  await mkdir(resolve(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, content);
}

async function readFixtureFile(root: string, path: string): Promise<string> {
  return await readFile(join(root, path), "utf8");
}

function runCli(args: readonly string[]) {
  return Bun.spawnSync({
    cmd: [process.execPath, cliPath, ...args],
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("rewriteCompatImportsToNative", () => {
  it("moves type-only native exports into an import type declaration", () => {
    const src = [
      'import { ok, err, type Ok, Result as CompatResult, ResultAsync, UnexpectedError } from "@onrails/result/compat/neverthrow";',
      "",
      "type Parsed = Result<number, UnexpectedError>;",
      "const parsed = ok(1);",
    ].join("\n");

    expect(rewriteCompatImportsToNative(src)).toBe(
      [
        'import { ok, err, ResultAsync } from "@onrails/result";',
        'import type { Ok, Result as CompatResult, UnexpectedError } from "@onrails/result";',
        "",
        "type Parsed = Result<number, UnexpectedError>;",
        "const parsed = ok(1);",
      ].join("\n"),
    );
  });

  it("rewrites type-only imports to the native package", () => {
    const src = 'import type { Result, Ok, Err } from "@onrails/result/compat/neverthrow";\n';

    expect(rewriteCompatImportsToNative(src)).toBe(
      'import type { Result, Ok, Err } from "@onrails/result";\n',
    );
  });
});

describe("collectNativeMigrationWarnings", () => {
  it("reports compat-only method chains for manual follow-up", () => {
    const src = [
      "const out = parse(raw)",
      "  .andThen(validate)",
      "  .orElse(recover)",
      "  .unwrapOr(defaultValue);",
      "if (out.isOk()) return out.value;",
    ].join("\n");

    expect(collectNativeMigrationWarnings(src)).toEqual([
      {
        line: 5,
        label: "compat predicate method",
        text: "if (out.isOk()) return out.value;",
      },
    ]);
  });

  it("does not report ordinary value and error properties", () => {
    const src = [
      "const next = entry.value;",
      "const message = parsed.error.message;",
      "const err = chatMutation.error;",
    ].join("\n");

    expect(collectNativeMigrationWarnings(src)).toEqual([]);
  });
});

describe("rewriteCompatMethodChainsToNative: sync rewrites", () => {
  it("rewrites supported sync method chains to pipe", () => {
    const src = [
      'import { ok } from "@onrails/result";',
      "",
      "const parsed = ok(1)",
      "  .map((n) => n + 1)",
      "  .andThen(validate)",
      "  .orElse(recoverInput);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(
      [
        'import { flatMap, map, ok, pipe, recover } from "@onrails/result";',
        "",
        "const parsed = pipe(ok(1), map((n) => n + 1), flatMap(validate), recover(recoverInput));",
      ].join("\n"),
    );
  });

  it("rewrites terminal match and unwrapOr calls", () => {
    const src = [
      'import { ok } from "@onrails/result";',
      "",
      "const value = ok(1).map(double).unwrapOr(0);",
      "const label = ok(1).match(String, () => 'bad');",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(
      [
        'import { map, match, ok, pipe, unwrapOr } from "@onrails/result";',
        "",
        "const value = unwrapOr(pipe(ok(1), map(double)), 0);",
        "const label = match(ok(1), String, () => 'bad');",
      ].join("\n"),
    );
  });
});

describe("rewriteCompatMethodChainsToNative: unchanged chains", () => {
  it("leaves ResultAsync-looking chains unchanged", () => {
    const src = [
      'import { ResultAsync } from "@onrails/result";',
      "",
      "const parsed = ResultAsync.ok(1).andThen(validate);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(src);
  });

  it("leaves non-terminal unknown-base transform chains unchanged", () => {
    const src = [
      'import { ResultAsync } from "@onrails/result";',
      "",
      "const parsed = chat(input).map((value) => value.id).mapErr(toError);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(src);
  });

  it("leaves async call-expression match chains unchanged", () => {
    const src = [
      'import { ResultAsync } from "@onrails/result";',
      "",
      "queryFn()",
      "  .tap(onValue)",
      "  .match(onOk, onErr)",
      "  .finally(cleanup);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(src);
  });

  it("leaves unknown-base async-looking terminal chains unchanged", () => {
    const src = [
      'import { ResultAsync } from "@onrails/result";',
      "",
      "mutationFn(variables)",
      "  .tap(onValue)",
      "  .tapErr(onError)",
      "  .match(onOk, onErr);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(src);
  });
});

describe("rewriteCompatMethodChainsToNative: predicate and helper rewrites", () => {
  it("does not rewrite ordinary array transform chains but rewrites result predicates", () => {
    const src = [
      'import { ok } from "@onrails/result";',
      "",
      "const values = rows",
      "  .map((row) => ok(row.value))",
      "  .filter((result) => result.isOk())",
      "  .map((result) => result.value);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(
      [
        'import { isOk, ok } from "@onrails/result";',
        "",
        "const values = rows",
        "  .map((row) => ok(row.value))",
        "  .filter((result) => isOk(result))",
        "  .map((result) => result.value);",
      ].join("\n"),
    );
  });

  it("rewrites result predicate and unsafe unwrap helpers", () => {
    const src = [
      'import { ok } from "@onrails/result";',
      "",
      "if (result.isOk()) return result._unsafeUnwrap();",
      "if (result.isErr()) return result._unsafeUnwrapErr();",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(
      [
        'import { isErr, isOk, ok, unwrapErr, unwrapOk } from "@onrails/result";',
        "",
        "if (isOk(result)) return unwrapOk(result);",
        "if (isErr(result)) return unwrapErr(result);",
      ].join("\n"),
    );
  });
});

describe("rewriteCompatMethodChainsToNative: helper renames", () => {
  it("rewrites neverthrow ok helpers with no value to explicit undefined", () => {
    const src = [
      'import { ok, okAsync } from "@onrails/result";',
      "",
      "const done = ok();",
      "const asyncDone = okAsync();",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(
      [
        'import { ok, okAsync } from "@onrails/result";',
        "",
        "const done = ok(undefined);",
        "const asyncDone = okAsync(undefined);",
      ].join("\n"),
    );
  });

  it("renames async tee helpers to native tap helpers", () => {
    const src = [
      'import { ResultAsync } from "@onrails/result";',
      "",
      "const out = ResultAsync.ok(1)",
      "  .andTee(onValue)",
      "  .orTee(onError);",
    ].join("\n");

    expect(rewriteCompatMethodChainsToNative(src)).toBe(
      [
        'import { ResultAsync } from "@onrails/result";',
        "",
        "const out = ResultAsync.ok(1)",
        "  .tap(onValue).tapErr(onError);",
      ].join("\n"),
    );
  });
});

describe("CLI: native rewrites", () => {
  it("dry-runs native import rewrites without changing files", async () => {
    const root = await makeFixture();
    const source = [
      'import { ok, Result } from "@onrails/result/compat/neverthrow";',
      "",
      "const parsed = ok(1).andThen((n) => ok(n + 1));",
      "type Parsed = Result<number, Error>;",
    ].join("\n");
    await writeFixtureFile(root, "src/index.ts", source);

    const result = runCli([root, "--to-native", "--dry"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("[DRY] mode=native");
    expect(result.stdout.toString()).toContain("[DRY] code files changed: 1");
    expect(await readFixtureFile(root, "src/index.ts")).toBe(source);
  });

  it("applies native import rewrites and reports compat follow-up", async () => {
    const root = await makeFixture();
    await writeFixtureFile(
      root,
      "src/index.ts",
      [
        'import { ok, Result, ResultAsync } from "@onrails/result/compat/neverthrow";',
        "",
        "const parsed = ok(1).andThen((n) => ok(n + 1));",
        "type Parsed = Result<number, Error>;",
        "const asyncParsed = ResultAsync.ok(1);",
      ].join("\n"),
    );

    const result = runCli([root, "--to-native"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("[APPLY] mode=native");
    expect(result.stdout.toString()).toContain("[APPLY] code files changed: 1");
    expect(await readFixtureFile(root, "src/index.ts")).toBe(
      [
        'import { ResultAsync, flatMap, ok, pipe } from "@onrails/result";',
        'import type { Result } from "@onrails/result";',
        "",
        "const parsed = pipe(ok(1), flatMap((n) => ok(n + 1)));",
        "type Parsed = Result<number, Error>;",
        "const asyncParsed = ResultAsync.ok(1);",
      ].join("\n"),
    );
  });
});

describe("CLI: unsupported and stage-1", () => {
  it("reports unsupported native migration imports without changing files", async () => {
    const root = await makeFixture();
    const source = [
      'import * as neverthrow from "@onrails/result/compat/neverthrow";',
      'export { ok } from "@onrails/result/compat/neverthrow";',
      "",
      "const parsed = neverthrow.ok(1);",
    ].join("\n");
    await writeFixtureFile(root, "src/index.ts", source);

    const result = runCli([root, "--to-native"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("[APPLY] code files changed: 0");
    expect(result.stdout.toString()).toContain("TODO line 1: unsupported compat import");
    expect(result.stdout.toString()).toContain("TODO line 2: unsupported compat import");
    expect(await readFixtureFile(root, "src/index.ts")).toBe(source);
  });
});

describe("CLI: stage-1 rewrites", () => {
  it("applies stage-1 neverthrow import and package rewrites", async () => {
    const root = await makeFixture();
    await writeFixtureFile(
      root,
      "package.json",
      JSON.stringify(
        {
          dependencies: {
            neverthrow: "^8.0.0",
          },
          devDependencies: {
            typescript: "^6.0.3",
          },
        },
        null,
        2,
      ),
    );
    await writeFixtureFile(
      root,
      "src/index.ts",
      [
        'import { ok } from "neverthrow";',
        "",
        'const mod = import("neverthrow");',
        "const parsed = ok(1);",
      ].join("\n"),
    );

    const result = runCli([root, `--onrails=${join(root, "onrails-result")}`]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain("[APPLY] mode=compat");
    expect(await readFixtureFile(root, "src/index.ts")).toBe(
      [
        'import { ok } from "@onrails/result/compat/neverthrow";',
        "",
        'const mod = import("@onrails/result/compat/neverthrow");',
        "const parsed = ok(1);",
      ].join("\n"),
    );
    expect(JSON.parse(await readFixtureFile(root, "package.json"))).toEqual({
      dependencies: {
        "@onrails/result": "file:onrails-result",
      },
      devDependencies: {
        typescript: "^6.0.3",
      },
    });
  });
});
