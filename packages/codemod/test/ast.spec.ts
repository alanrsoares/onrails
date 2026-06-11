import { describe, expect, it } from "bun:test";
import { none, some } from "@onrails/maybe";
import ts from "typescript";
import {
  concatCollectors,
  countOccurrences,
  importedName,
  isTypeOnlyNative,
  isValueImport,
  lookupMap,
  spanEdit,
  splitImportNames,
  stripInlineType,
  walkSource,
} from "../src/ast.js";

describe("splitImportNames", () => {
  const cases = [
    { label: "single name", input: "ok", expected: ["ok"] },
    { label: "multiple names with spaces", input: " ok , err ", expected: ["ok", "err"] },
    { label: "trailing comma", input: "ok, err,", expected: ["ok", "err"] },
    { label: "empty string", input: "", expected: [] },
    { label: "inline type kept verbatim", input: "type Ok, err", expected: ["type Ok", "err"] },
  ];

  it.each(cases)("$label", ({ input, expected }) => {
    expect(splitImportNames(input)).toEqual([...expected]);
  });
});

describe("stripInlineType / importedName", () => {
  const cases = [
    { label: "plain value name", input: "ok", stripped: "ok", name: "ok" },
    { label: "inline type prefix", input: "type Ok", stripped: "Ok", name: "Ok" },
    {
      label: "renamed import",
      input: "Result as CompatResult",
      stripped: "Result as CompatResult",
      name: "Result",
    },
    { label: "renamed type import", input: "type Ok as MyOk", stripped: "Ok as MyOk", name: "Ok" },
  ];

  it.each(cases)("$label", ({ input, stripped, name }) => {
    expect(stripInlineType(input)).toBe(stripped);
    expect(importedName(input)).toBe(name);
  });
});

describe("isTypeOnlyNative / isValueImport", () => {
  const cases = [
    { label: "inline type prefix", input: "type Foo", typeOnly: true },
    { label: "known type-only export (Result)", input: "Result", typeOnly: true },
    { label: "renamed known type-only export", input: "Result as CompatResult", typeOnly: true },
    { label: "value export (ok)", input: "ok", typeOnly: false },
    { label: "value export (ResultAsync)", input: "ResultAsync", typeOnly: false },
  ];

  it.each(cases)("$label", ({ input, typeOnly }) => {
    expect(isTypeOnlyNative(input)).toBe(typeOnly);
    expect(isValueImport(input)).toBe(!typeOnly);
  });
});

describe("countOccurrences", () => {
  const cases = [
    { label: "no occurrence", s: "abc", sub: "x", expected: 0 },
    { label: "single occurrence", s: "abc", sub: "b", expected: 1 },
    { label: "repeated occurrences", s: "aaa", sub: "a", expected: 3 },
    { label: "overlap counts disjoint splits only", s: "aaaa", sub: "aa", expected: 2 },
  ];

  it.each(cases)("$label", ({ s, sub, expected }) => {
    expect(countOccurrences(s, sub)).toBe(expected);
  });
});

describe("concatCollectors", () => {
  it("concatenates collector outputs in declaration order", () => {
    const first = (s: string) => (s.includes("a") ? ["a"] : []);
    const second = (s: string) => (s.includes("b") ? ["b"] : []);
    expect(concatCollectors(first, second)("ab")).toEqual(["a", "b"]);
    expect(concatCollectors(first, second)("b")).toEqual(["b"]);
    expect(concatCollectors(first, second)("")).toEqual([]);
  });
});

describe("lookupMap", () => {
  it("maps a present key through f", () => {
    expect(lookupMap(new Map([["k", 2]]), "k", (v) => v * 10)).toEqual(some(20));
  });

  it("returns none for a missing key", () => {
    expect(lookupMap(new Map<string, number>(), "k", (v) => v * 10)).toEqual(none());
  });
});

describe("walkSource / spanEdit", () => {
  it("visits call expressions and stops descending when visit returns truthy", () => {
    const seen: string[] = [];
    walkSource(`foo(bar(1));`, (node, sf) => {
      if (ts.isCallExpression(node)) {
        seen.push(node.expression.getText(sf));
        return true; // skip children — bar(1) must not be visited
      }
      return undefined;
    });
    expect(seen).toEqual(["foo"]);
  });

  it("spanEdit anchors the edit to the node's source span", () => {
    let edit: { start: number; end: number; text: string } | undefined;
    const src = `const x = target(1);`;
    walkSource(src, (node, sf) => {
      if (ts.isCallExpression(node)) {
        edit = spanEdit(node, sf, { start: 0, end: 0, text: "replaced", imports: [] });
        return true;
      }
      return undefined;
    });
    expect(edit).toBeDefined();
    expect(src.slice(edit?.start, edit?.end)).toBe("target(1)");
  });
});
