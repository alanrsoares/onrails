import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { isOk, unwrapOr } from "@onrails/result";
import { defaultCategorize, extractExports } from "../src/api/extract.js";
import { defaultResolveLink, renderPackageMdx, slugify } from "../src/api/render.js";
import type { DocSymbol, ExportsByPackage } from "../src/api/types.js";

const FIXTURE = resolve(import.meta.dir, "fixtures/sample.ts");

describe("slugify", () => {
  it("lowercases, strips punctuation, and hyphenates whitespace", () => {
    expect(slugify("Foo Bar!")).toBe("foo-bar");
    expect(slugify("ResultAsync.fromPromise")).toBe("resultasyncfrompromise");
  });
});

describe("defaultResolveLink", () => {
  const exports: ExportsByPackage = new Map([
    ["@scope/a", new Set(["Alpha"])],
    ["@scope/b", new Set(["Beta"])],
  ]);

  it("uses a local anchor when the current package owns the symbol", () => {
    expect(defaultResolveLink("Beta", "@scope/b", exports)).toBe("#beta");
  });

  it("links to the owning sibling package", () => {
    expect(defaultResolveLink("Alpha", "@scope/b", exports)).toBe("./a#alpha");
  });

  it("falls back to a local anchor for unknown symbols", () => {
    expect(defaultResolveLink("Gamma", "@scope/b", exports)).toBe("#gamma");
  });
});

describe("extractExports", () => {
  const extracted = extractExports(FIXTURE, "@test/sample", defaultCategorize);
  const byName = new Map(unwrapOr(extracted, [] as DocSymbol[]).map((s) => [s.name, s]));

  it("returns ok for a valid entrypoint", () => {
    expect(isOk(extracted)).toBe(true);
  });

  it("extracts exported symbols with kinds", () => {
    expect(byName.get("add")?.kind).toBe("function");
    expect(byName.get("Pair")?.kind).toBe("type");
  });

  it("reads @category, @param, and @returns from JSDoc", () => {
    const add = byName.get("add");
    expect(add?.category).toBe("Math");
    expect(add?.params.map((p) => p.name)).toEqual(["a", "b"]);
    expect(add?.params[0]?.description).toBe("the first addend");
    expect(add?.returns).toBe("the sum of `a` and `b`");
  });

  it("flags @deprecated symbols", () => {
    const greeting = byName.get("greeting");
    expect(greeting?.isDeprecated).toBe(true);
    expect(greeting?.deprecationMessage).toBe("use a template literal instead");
  });
});

describe("renderPackageMdx", () => {
  const symbols: DocSymbol[] = [
    {
      name: "beta",
      kind: "function",
      signature: "function beta(): void",
      description: "Second. See {@link alpha}.",
      examples: [],
      params: [{ name: "x", type: "number | string", description: "an input" }],
      returns: "",
      category: "Core",
      isDeprecated: false,
      deprecationMessage: "",
    },
    {
      name: "alpha",
      kind: "type",
      signature: "type alpha = string",
      description: "First.",
      examples: [],
      params: [],
      returns: "",
      category: "Types",
      isDeprecated: false,
      deprecationMessage: "",
    },
  ];
  const exports: ExportsByPackage = new Map([["@test/pkg", new Set(["alpha", "beta"])]]);
  const mdx = renderPackageMdx("@test/pkg", symbols, exports, {
    categoryOrder: { "@test/pkg": ["Core", "Types"] },
  });

  it("emits frontmatter and the package heading", () => {
    expect(mdx).toContain('title: "@test/pkg API"');
    expect(mdx).toContain("# @test/pkg API Reference");
  });

  it("orders categories by categoryOrder", () => {
    expect(mdx.indexOf("## Core")).toBeLessThan(mdx.indexOf("## Types"));
  });

  it("escapes pipes in the params table", () => {
    expect(mdx).toContain("`number \\| string`");
  });

  it("resolves {@link} via the exports map (local anchor)", () => {
    expect(mdx).toContain("[alpha](#alpha)");
  });
});
