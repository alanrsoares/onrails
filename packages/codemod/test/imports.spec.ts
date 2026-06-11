import { describe, expect, it } from "bun:test";
import {
  addNativeValueImports,
  rewriteCompatImportsToNative,
  toNativeImport,
} from "../src/imports.js";

const COMPAT = "@onrails/result/compat/neverthrow";
const NATIVE = "@onrails/result";

describe("toNativeImport", () => {
  const cases = [
    {
      label: "value-only specifiers",
      specifiers: "ok, err",
      expected: `import { ok, err } from "${NATIVE}";`,
    },
    {
      label: "type-only specifiers move to import type",
      specifiers: "type Ok, Result",
      expected: `import type { Ok, Result } from "${NATIVE}";`,
    },
    {
      label: "mixed specifiers split into two declarations",
      specifiers: "ok, type Err, ResultAsync",
      expected: `import { ok, ResultAsync } from "${NATIVE}";\nimport type { Err } from "${NATIVE}";`,
    },
    {
      label: "known type-only names treated as types without prefix",
      specifiers: "ok, UnexpectedError",
      expected: `import { ok } from "${NATIVE}";\nimport type { UnexpectedError } from "${NATIVE}";`,
    },
  ];

  it.each(cases)("$label", ({ specifiers, expected }) => {
    expect(toNativeImport("FULL", specifiers, '"')).toBe(expected);
  });

  it("returns the original statement when no specifiers survive", () => {
    expect(toNativeImport("FULL", "", '"')).toBe("FULL");
  });
});

describe("rewriteCompatImportsToNative", () => {
  const cases = [
    {
      label: "named value import",
      input: `import { ok, err } from "${COMPAT}";`,
      expected: `import { ok, err } from "${NATIVE}";`,
    },
    {
      label: "import type declaration",
      input: `import type { Ok, Err } from "${COMPAT}";`,
      expected: `import type { Ok, Err } from "${NATIVE}";`,
    },
    {
      label: "single quotes preserved",
      input: `import { ok } from '${COMPAT}';`,
      expected: `import { ok } from '${NATIVE}';`,
    },
    {
      label: "unrelated imports untouched",
      input: `import { x } from "other";`,
      expected: `import { x } from "other";`,
    },
  ];

  it.each(cases)("$label", ({ input, expected }) => {
    expect(rewriteCompatImportsToNative(input)).toBe(expected);
  });
});

describe("addNativeValueImports", () => {
  it("prepends a new import when none exists", () => {
    expect(addNativeValueImports("const x = 1;\n", ["ok", "err"])).toBe(
      `import { err, ok } from "${NATIVE}";\nconst x = 1;\n`,
    );
  });

  it("merges into an existing native import, deduped and sorted", () => {
    const src = `import { ok } from "${NATIVE}";\nconst x = 1;\n`;
    expect(addNativeValueImports(src, ["err", "ok"])).toBe(
      `import { err, ok } from "${NATIVE}";\nconst x = 1;\n`,
    );
  });

  it("returns the source unchanged for an empty import list", () => {
    const src = `const x = 1;\n`;
    expect(addNativeValueImports(src, [])).toBe(src);
  });
});
