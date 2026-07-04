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

const rule = plugin.rules["fluent-stays-local"];

tester.run("fluent-stays-local", rule, {
  valid: [
    // opens and closes within a function body
    "function run() { return fluent(r).map((n) => n + 1).toResult(); }",
    "const out = fluent(r).map((n) => n + 1).unwrapOr(0);",
    // local annotation that never escapes
    "function run() { const chain = fluent(r); return chain.toResult(); }",
    // unrelated types are untouched
    "function run(): Result<number, string> { return r; }",
    "export const cached = toResult(fluent(r));",
    "postMessage(fluent(r).toResult());",
    "postMessage(other);",
  ],
  invalid: [
    {
      code: "function run(): FluentResult<number, string> { return fluent(r); }",
      errors: [{ messageId: "returnType", data: { name: "FluentResult" } }],
    },
    {
      code: "const build = (): FluentMaybe<number> => fluent(m);",
      errors: [{ messageId: "returnType", data: { name: "FluentMaybe" } }],
    },
    {
      code: "export const chain: FluentResult<number, string> = fluent(r);",
      errors: [{ messageId: "exported", data: { name: "FluentResult" } }],
    },
    {
      code: "class Store { chain: FluentResult<number, string>; }",
      errors: [{ messageId: "storedField", data: { name: "FluentResult" } }],
    },
    {
      code: "interface Holder { chain: FluentMaybe<number>; }",
      errors: [{ messageId: "storedField", data: { name: "FluentMaybe" } }],
    },
    {
      code: "postMessage(fluent(r));",
      errors: [{ messageId: "serializeArg", data: { sink: "postMessage" } }],
    },
    {
      code: "structuredClone(fluent(r).map((n) => n + 1));",
      errors: [{ messageId: "serializeArg", data: { sink: "structuredClone" } }],
    },
    {
      code: "JSON.stringify(fluent(r));",
      errors: [{ messageId: "serializeArg", data: { sink: "JSON.stringify" } }],
    },
  ],
});
