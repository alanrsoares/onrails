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

const rule = plugin.rules["no-unsafe-unwrap"];

tester.run("no-unsafe-unwrap", rule, {
  valid: [
    // Production-style file: nothing to flag here.
    { code: "const x = result.match();", filename: "src/handler.ts" },
    // Test file — rule is a no-op.
    { code: "const v = result._unsafeUnwrap();", filename: "test/foo.spec.ts" },
    { code: "unwrapOk(result);", filename: "test/foo.spec.ts" },
    { code: "unwrapErr(result);", filename: "test/foo.spec.ts" },
    { code: "unwrap(maybe);", filename: "test/foo.spec.ts" },
  ],
  invalid: [
    {
      code: "const v = result._unsafeUnwrap();",
      filename: "src/handler.ts",
      errors: [{ messageId: "unsafe" }],
    },
    {
      code: "const e = result._unsafeUnwrapErr();",
      filename: "src/handler.ts",
      errors: [{ messageId: "unsafe" }],
    },
    {
      code: "unwrapOk(result);",
      filename: "src/handler.ts",
      errors: [{ messageId: "unsafe" }],
    },
    {
      code: "unwrapErr(result);",
      filename: "src/handler.ts",
      errors: [{ messageId: "unsafe" }],
    },
    {
      code: "unwrap(maybe);",
      filename: "src/handler.ts",
      errors: [{ messageId: "unsafe" }],
    },
  ],
});
