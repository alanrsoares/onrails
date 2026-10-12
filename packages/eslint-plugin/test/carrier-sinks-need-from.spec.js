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
  ],
});
