import { describe, it } from "bun:test";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import plugin from "../src/index.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  },
});

tester.run("carrier-sinks-need-from", plugin.rules["carrier-sinks-need-from"], {
  valid: [
    // lifted back into a live carrier
    "const r = Result.from<number, string>(JSON.parse(raw));",
    "const m = Maybe.from<number>(structuredClone(x));",
    // plain-data annotations are fine
    "const d = JSON.parse(raw) as ResultData<number, string>;",
    "const d: MaybeData<number> = JSON.parse(raw);",
    // not a sink
    "const r = load() as Result<number, string>;",
    "const r: Result<number, string> = ok(1);",
    // sinks typed as something unrelated
    "const cfg = JSON.parse(raw) as Config;",
    "const body = (await res.json()) as Body;",
    // flow into a non-carrier return, or through a lift
    "function f(s: string): Config { return JSON.parse(s); }",
    "function f(s: string): Result<number, string> { return Result.from(JSON.parse(s)); }",
    "const f = (s: string): Result<number, string> => Result.from(JSON.parse(s) as ResultData<number, string>);",
    "function f(s: string): Result<number, string> { const x = JSON.parse(s); return Result.from(x); }",
    // `let` and reassigned bindings are not followed
    "let x = JSON.parse(s); const r = x as Result<number, string>;",
    // plain-data type argument
    "const d = await res.json<ResultData<number, string>>();",
    // param default lifted
    "function f(r: Result<number, string> = Result.from(JSON.parse(s))) {}",
  ],
  invalid: [
    // a non-carrier cast must not hide an annotated carrier declaration
    { code: "const r: Result<number, string> = JSON.parse(raw) as any;", errors: [{ messageId: "needsFrom" }] },
    { code: "const m: Maybe<number> = (await res.json()) as unknown;", errors: [{ messageId: "needsFrom" }] },
    { code: "const r = JSON.parse(raw) as Result<number, string>;", errors: [{ messageId: "needsFrom" }] },
    { code: "const m = structuredClone(x) as Maybe<number>;", errors: [{ messageId: "needsFrom" }] },
    {
      code: "const r = (await res.json()) as Result<User, ApiError>;",
      errors: [{ messageId: "needsFrom" }],
    },
    { code: "const r: Result<number, string> = JSON.parse(raw);", errors: [{ messageId: "needsFrom" }] },
    { code: "const m: Maybe<number> = await res.json();", errors: [{ messageId: "needsFrom" }] },
    // returned from a carrier-typed function
    { code: "function f(s: string): Result<number, string> { return JSON.parse(s); }", errors: [{ messageId: "needsFrom" }] },
    { code: "const f = (s: string): Result<number, string> => JSON.parse(s);", errors: [{ messageId: "needsFrom" }] },
    { code: "async function f(): Promise<Result<number, string>> { return res.json(); }", errors: [{ messageId: "needsFrom" }] },
    { code: "async function f(): Promise<Maybe<number>> { return await res.json(); }", errors: [{ messageId: "needsFrom" }] },
    { code: "function f(s: string): Result<number, string> { return JSON.parse(s) as any; }", errors: [{ messageId: "needsFrom" }] },
    // through an intermediate const
    { code: "const x = JSON.parse(s); const r = x as Result<number, string>;", errors: [{ messageId: "needsFrom" }] },
    { code: "const x = JSON.parse(s); const r: Maybe<number> = x;", errors: [{ messageId: "needsFrom" }] },
    { code: "const x = structuredClone(v); function f(): Result<number, string> { return x; }", errors: [{ messageId: "needsFrom" }] },
    // carrier named through the call's type argument
    { code: "const r = await res.json<Result<number, string>>();", errors: [{ messageId: "needsFrom" }] },
    // parameter default
    { code: "function f(r: Result<number, string> = JSON.parse(s)) {}", errors: [{ messageId: "needsFrom" }] },
    // each reported once, not once per visitor
    { code: "function f(s: string): Result<number, string> { return JSON.parse(s) as Result<number, string>; }", errors: [{ messageId: "needsFrom" }] },
  ],
});
