import { dirname } from "node:path";
import { isErr, ok, type Result, trySync } from "@onrails/result";
import { type Categorize, defaultCategorize, extractExports } from "./extract.js";
import { defaultCompilerHost } from "./host.js";
import { renderPackageMdx } from "./render.js";
import { toError } from "./to-error.js";
import type {
  ApiDocsOptions,
  ApiPackage,
  DocSymbol,
  ExportsByPackage,
  SymbolKind,
} from "./types.js";

/**
 * Generate API-reference MDX for each package from its TypeScript source +
 * JSDoc/TSDoc. Parses every package first to build a cross-package export map
 * (used by `{@link}` resolution), then renders and writes each file. Returns
 * the written output paths, or `err` on the first package that fails to parse
 * or write. Reporting is left to the caller.
 */
export const generateApiDocs = (
  packages: readonly ApiPackage[],
  opts: ApiDocsOptions = {},
): Result<readonly string[], Error> => {
  const host = opts.host ?? defaultCompilerHost;
  const categorize: Categorize = (name, pkg, tags) =>
    opts.categorize?.(name, pkg, tags) ?? defaultCategorize(name, pkg, tags);

  const parsed: { pkg: ApiPackage; symbols: DocSymbol[] }[] = [];
  for (const pkg of packages) {
    const extracted = extractExports(pkg.entry, pkg.name, categorize, host);
    if (isErr(extracted)) return extracted;
    parsed.push({ pkg, symbols: extracted.value });
  }

  const exports: ExportsByPackage = new Map<string, ReadonlyMap<string, SymbolKind>>(
    parsed.map(({ pkg, symbols }) => {
      const map = new Map<string, SymbolKind>();
      const addSymbol = (s: DocSymbol) => {
        map.set(s.name, s.kind);
        if (s.kind === "class") {
          for (const m of s.staticMethods ?? []) addSymbol(m);
          for (const m of s.instanceMethods ?? []) addSymbol(m);
        }
      };
      for (const s of symbols) {
        addSymbol(s);
      }
      return [pkg.name, map];
    }),
  );

  const writeMdx = trySync((out: string, mdx: string) => {
    host.mkdir(dirname(out));
    host.writeFile(out, mdx);
  }, toError);

  const written: string[] = [];
  for (const { pkg, symbols } of parsed) {
    const result = writeMdx(pkg.out, renderPackageMdx(pkg.name, symbols, exports, opts));
    if (isErr(result)) return result;
    written.push(pkg.out);
  }

  return ok(written);
};
