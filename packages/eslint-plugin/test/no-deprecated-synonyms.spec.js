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

const rule = plugin.rules["no-deprecated-synonyms"];

tester.run("no-deprecated-synonyms", rule, {
  valid: [
    // Canonical names: nothing to flag.
    { code: "const x = result.flatMap(fn);" },
    { code: "const y = match(result, { Ok: onOk, Err: onErr });" },
    { code: "const z = unwrapOr(result, fallback);" },
    { code: "const r = ok(1);" },
    // Free-function guards are the canonical form.
    { code: "if (isOk(result)) { use(result.value); }" },
    // `of` is only deprecated as a bare call, not as a member.
    { code: "const kw = table.of(1);" },
    // Not a call — `of` keyword in for-of.
    { code: "for (const item of items) { use(item); }" },
  ],
  invalid: [
    {
      code: "const x = result.chain(fn);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const x = result?.chain(fn);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "if (asyncResult.isOk()) { go(); }",
      errors: [{ messageId: "narrowGuard" }],
    },
    {
      code: "if (asyncResult.isErr()) { bail(); }",
      errors: [{ messageId: "narrowGuard" }],
    },
    {
      code: "const y = fold(handlers);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const y = matchResult(handlers);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const y = matchMaybe(handlers);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const v = getOrElse(fallback);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const t = sequenceTupleAsync(results);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const c = collect(results);",
      errors: [{ messageId: "rename" }],
    },
    {
      code: "const o = of(1);",
      errors: [{ messageId: "rename" }],
    },
  ],
});
