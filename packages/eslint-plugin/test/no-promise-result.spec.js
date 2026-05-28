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

const rule = plugin.rules["no-promise-result"];

tester.run("no-promise-result", rule, {
  valid: [
    "function f(): ResultAsync<number, Error> { return null as any; }",
    "function f(): Promise<number> { return Promise.resolve(1); }",
    "type X = Result<number, Error>;",
    // multi-line ResultAsync is fine
    "function f(): ResultAsync<\n  number,\n  Error\n> { return null as any; }",
  ],
  invalid: [
    {
      code: "function f(): Promise<Result<number, Error>> { return null as any; }",
      errors: [{ messageId: "use", data: { ok: "number", err: "Error" } }],
      output: "function f(): ResultAsync<number, Error> { return null as any; }",
    },
    {
      // Multi-line wrap — single-regex impl would miss this. AST catches it.
      code: "type X = Promise<\n  Result<\n    string,\n    { kind: 'fail' }\n  >\n>;",
      errors: [{ messageId: "use" }],
      output: "type X = ResultAsync<string, { kind: 'fail' }>;",
    },
    {
      code: "interface I { run(): Promise<Result<{ id: string }, HttpError>>; }",
      errors: [{ messageId: "use" }],
      output: "interface I { run(): ResultAsync<{ id: string }, HttpError>; }",
    },
  ],
});
