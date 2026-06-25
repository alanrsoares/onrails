import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { isOk, unwrapOr } from "@onrails/result";
import { defaultCategorize, extractExports } from "../src/api/extract.js";
import { defaultResolveLink, renderPackageMdx, slugify } from "../src/api/render.js";
import type { DocSymbol, ExportsByPackage, SymbolKind } from "../src/api/types.js";

const FIXTURE = resolve(import.meta.dir, "fixtures/sample.ts");

describe("slugify", () => {
  it("lowercases, strips punctuation, and hyphenates whitespace", () => {
    expect(slugify("Foo Bar!")).toBe("foo-bar");
    expect(slugify("ResultAsync.fromPromise")).toBe("resultasyncfrompromise");
  });
});

describe("defaultResolveLink", () => {
  const exports: ExportsByPackage = new Map<string, ReadonlyMap<string, SymbolKind>>([
    ["@scope/a", new Map<string, SymbolKind>([["Alpha", "function"]])],
    ["@scope/b", new Map<string, SymbolKind>([["Beta", "type"]])],
  ]);

  it("uses a local anchor when the current package owns the symbol", () => {
    expect(defaultResolveLink("Beta", "@scope/b", exports)).toBe("#beta-type");
  });

  it("links to the owning sibling package", () => {
    expect(defaultResolveLink("Alpha", "@scope/b", exports)).toBe("./a#alpha-ƒ");
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
  const exports: ExportsByPackage = new Map<string, ReadonlyMap<string, SymbolKind>>([
    [
      "@test/pkg",
      new Map<string, SymbolKind>([
        ["alpha", "type"],
        ["beta", "function"],
      ]),
    ],
  ]);
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
    expect(mdx).toContain("[alpha](#alpha-type)");
  });
});

import ts from "typescript";
import { checkExamples } from "../src/api/check.js";
import { generateApiDocs } from "../src/api/generate.js";
import type { ApiCompilerHost } from "../src/api/types.js";

class MemoryCompilerHost implements ApiCompilerHost {
  files = new Map<string, string>();
  dirs = new Set<string>();

  fileExists(p: string): boolean {
    return this.files.has(p);
  }

  readFile(p: string): string | undefined {
    return this.files.get(p);
  }

  writeFile(p: string, content: string): void {
    this.files.set(p, content);
  }

  mkdir(p: string): void {
    this.dirs.add(p);
  }

  mkdtemp(prefix: string): string {
    return `${prefix}-mem`;
  }

  rm(p: string): void {
    for (const k of this.files.keys()) {
      if (k.startsWith(p)) {
        this.files.delete(k);
      }
    }
    for (const d of this.dirs) {
      if (d.startsWith(p)) {
        this.dirs.delete(d);
      }
    }
  }

  createProgram(rootNames: readonly string[], options: ts.CompilerOptions): ts.Program {
    const tsHost = ts.createCompilerHost(options);

    tsHost.fileExists = (fileName) => {
      if (this.files.has(fileName)) return true;
      return ts.sys.fileExists(fileName);
    };

    tsHost.readFile = (fileName) => {
      if (this.files.has(fileName)) {
        return this.files.get(fileName);
      }
      return ts.sys.readFile(fileName);
    };

    tsHost.writeFile = (fileName, data) => {
      this.files.set(fileName, data);
    };

    return ts.createProgram(rootNames, options, tsHost);
  }
}

describe("generateApiDocs with MemoryCompilerHost", () => {
  it("parses source files in memory and writes output MDX to the virtual host", () => {
    const host = new MemoryCompilerHost();
    const entryPath = resolve("packages/math/src/index.ts");
    const outPath = resolve("apps/docs/content/docs/api/math.mdx");

    host.writeFile(
      entryPath,
      `
      /**
       * Add two numbers.
       * @category Math
       * @param a the first addend
       * @param b the second addend
       * @returns the sum of \`a\` and \`b\`
       */
      export const add = (a: number, b: number): number => a + b;
      `,
    );

    const result = generateApiDocs(
      [
        {
          entry: entryPath,
          name: "@onrails/math",
          out: outPath,
        },
      ],
      { host },
    );

    expect(isOk(result)).toBe(true);
    expect(unwrapOr(result, [] as string[])).toEqual([outPath]);
    expect(host.fileExists(outPath)).toBe(true);
    const mdx = host.readFile(outPath);
    expect(mdx).toContain("# @onrails/math API Reference");
    expect(mdx).toContain("### add");
    expect(mdx).toContain("Add two numbers.");
  });
});

describe("checkExamples with MemoryCompilerHost", () => {
  it("succeeds when all JSDoc examples are type-correct", () => {
    const host = new MemoryCompilerHost();
    const entryPath = resolve("packages/math/src/index.ts");

    host.writeFile(
      entryPath,
      `
      /**
       * Add two numbers.
       * @category Math
       * @example
       * \`\`\`ts
       * add(1, 2);
       * \`\`\`
       */
      export const add = (a: number, b: number): number => a + b;
      `,
    );

    const result = checkExamples(
      [
        {
          entry: entryPath,
          name: "@onrails/math",
        },
      ],
      {
        baseUrl: resolve("."),
        paths: {
          "@onrails/math": [entryPath],
        },
        host,
      },
    );

    expect(isOk(result)).toBe(true);
    const report = unwrapOr(result, null);
    expect(report?.failures).toEqual([]);
    expect(report?.total).toBe(1);
  });

  it("reports a failure when a JSDoc example has a compilation error", () => {
    const host = new MemoryCompilerHost();
    const entryPath = resolve("packages/math/src/index.ts");

    host.writeFile(
      entryPath,
      `
      /**
       * Add two numbers.
       * @category Math
       * @example
       * \`\`\`ts
       * add("not", "numbers");
       * \`\`\`
       */
      export const add = (a: number, b: number): number => a + b;
      `,
    );

    const result = checkExamples(
      [
        {
          entry: entryPath,
          name: "@onrails/math",
        },
      ],
      {
        baseUrl: resolve("."),
        paths: {
          "@onrails/math": [entryPath],
        },
        host,
      },
    );

    expect(isOk(result)).toBe(true);
    const report = unwrapOr(result, null);
    expect(report?.failures.length).toBe(1);
    expect(report?.failures[0]?.symbol).toBe("add");
    expect(report?.failures[0]?.messages[0]).toContain("TS2345");
  });
});
