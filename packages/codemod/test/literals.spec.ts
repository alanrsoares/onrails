import { describe, expect, it } from "bun:test";
import { computeFileChange } from "../src/file-change.js";
import { rewriteCarrierLiterals } from "../src/literals.js";

const OK = 'import { ok } from "@onrails/result";\n';
const ERR = 'import { err } from "@onrails/result";\n';
const BOTH = 'import { err, ok } from "@onrails/result";\n';
const RM = 'import { some } from "@onrails/maybe";\n';

describe("rewriteCarrierLiterals", () => {
  const cases = [
    {
      label: "Ok literal",
      src: `const a = { _tag: "Ok", value: 1 };`,
      out: `${OK}const a = ok(1);`,
    },
    {
      label: "Err literal, key order and quotes free",
      src: `const a = { error: "x", '_tag': 'Err' };`,
      out: `${ERR}const a = err("x");`,
    },
    {
      label: "shorthand payload",
      src: `const a = { _tag: "Ok", value };`,
      out: `${OK}const a = ok(value);`,
    },
    {
      label: "trailing as const is dropped with the literal",
      src: `const a = { _tag: "Err", error: new Error("x") } as const;`,
      out: `${ERR}const a = err(new Error("x"));`,
    },
    {
      label: "Some literal",
      src: `const a = { _tag: "Some", value: 3 };`,
      out: `${RM}const a = some(3);`,
    },
    {
      label: "None literal",
      src: `const a = { _tag: "None" };`,
      out: 'import { none } from "@onrails/maybe";\nconst a = none();',
    },
    {
      label: "nested literals rewrite across passes",
      src: `const a = { _tag: "Ok", value: { _tag: "Err", error: 1 } };`,
      out: `${BOTH}const a = ok(err(1));`,
    },
  ];

  it.each(cases)("rewrites: $label", ({ src, out }) => {
    expect(rewriteCarrierLiterals(src)).toBe(out);
  });

  const untouched = [
    { label: "extra key", src: `const a = { _tag: "Ok", value: 1, extra: 2 };` },
    { label: "spread", src: `const a = { ...base, _tag: "Ok", value: 1 };` },
    { label: "dynamic tag", src: `const a = { _tag: tag, value: 1 };` },
    { label: "unrelated tag", src: `const a = { _tag: "Circle", value: 1 };` },
    { label: "type position", src: `type R = { readonly _tag: "Ok"; readonly value: number };` },
    { label: "wrong payload key", src: `const a = { _tag: "Ok", error: 1 };` },
    {
      label: "local binding shadows the constructor name",
      src: `import { ok } from "./mine";\nconst a = { _tag: "Ok", value: 1 };`,
    },
  ];

  it.each(untouched)("leaves alone: $label", ({ src }) => {
    expect(rewriteCarrierLiterals(src)).toBe(src);
  });
});

describe("rewriteCarrierLiterals: shadowing", () => {
  it.each([
    {
      label: "parameter",
      src: `function f(ok: (n: number) => number) { return { _tag: "Ok", value: 1 }; }`,
    },
    {
      label: "destructured parameter",
      src: `const f = ({ ok }: Deps) => ({ _tag: "Ok", value: 1 });`,
    },
    {
      label: "block const",
      src: `function f() { const err = mk(); return { _tag: "Err", error: 1 }; }`,
    },
    {
      label: "catch variable",
      src: `try { run(); } catch (some) { use({ _tag: "Some", value: 1 }); }`,
    },
    { label: "for-of binding", src: `for (const none of xs) { use({ _tag: "None" }); }` },
  ])("leaves alone when a nested scope shadows the constructor: $label", ({ src }) => {
    expect(rewriteCarrierLiterals(src)).toBe(src);
  });

  it("still rewrites in a sibling scope that does not shadow", () => {
    const src = `function a(ok: unknown) { return ok; }\nconst b = { _tag: "Ok", value: 1 };`;
    expect(rewriteCarrierLiterals(src)).toBe(
      `${OK}${src.replace('{ _tag: "Ok", value: 1 }', "ok(1)")}`,
    );
  });
});

describe("rewriteCarrierLiterals: import handling", () => {
  it("ignores import-looking text in strings and comments when merging", () => {
    const src = `const note = 'import { map } from "@onrails/result";';\nconst a = { _tag: "Ok", value: 1 };`;
    expect(rewriteCarrierLiterals(src)).toBe(
      `${OK}const note = 'import { map } from "@onrails/result";';\nconst a = ok(1);`,
    );
  });

  it("inserts the import after a shebang", () => {
    expect(rewriteCarrierLiterals(`#!/usr/bin/env bun\nconst a = { _tag: "Ok", value: 1 };`)).toBe(
      `#!/usr/bin/env bun\n${OK}const a = ok(1);`,
    );
  });

  it("keeps inline type specifiers type-only when merging", () => {
    const src = `import { type Result } from "@onrails/result";\nconst a = { _tag: "Ok", value: 1 };`;
    expect(rewriteCarrierLiterals(src)).toBe(
      `import { type Result, ok } from "@onrails/result";\nconst a = ok(1);`,
    );
  });

  it("adds a value import beside an import type declaration", () => {
    const src = `import type { Result } from "@onrails/result";\nconst a = { _tag: "Ok", value: 1 };`;
    expect(rewriteCarrierLiterals(src)).toBe(
      `${OK}${src.replace('{ _tag: "Ok", value: 1 }', "ok(1)")}`,
    );
  });

  it("rewrites literals nested deeper than any fixed pass count", () => {
    const depth = 12;
    const src = `const a = ${'{ _tag: "Ok", value: '.repeat(depth)}1${" }".repeat(depth)};`;
    expect(rewriteCarrierLiterals(src)).toBe(
      `${OK}const a = ${"ok(".repeat(depth)}1${")".repeat(depth)};`,
    );
  });
});

describe("rewriteCarrierLiterals: imports and edge cases", () => {
  it("merges into an existing onrails import", () => {
    const src = `import { map } from "@onrails/result";\nconst a = { _tag: "Ok", value: 1 };`;
    expect(rewriteCarrierLiterals(src)).toBe(
      `import { map, ok } from "@onrails/result";\nconst a = ok(1);`,
    );
  });

  it("is idempotent", () => {
    const once = rewriteCarrierLiterals(`const a = { _tag: "Ok", value: 1 };`);
    expect(rewriteCarrierLiterals(once)).toBe(once);
  });

  it("is reachable as the literals mode", () => {
    const c = computeFileChange(`const a = { _tag: "Ok", value: 1 };`, "literals");
    expect(c._tag).toBe("Some");
  });
});
