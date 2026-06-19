import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isErr, ok, type Result, trySync } from "@onrails/result";
import { type Categorize, defaultCategorize, extractExports } from "./extract.js";
import { renderPackageMdx } from "./render.js";
import { toError } from "./to-error.js";
import type { ApiDocsOptions, ApiPackage, DocSymbol } from "./types.js";

// fs writes are a boundary — a safe, Result-returning writer.
const writeMdx = trySync((out: string, mdx: string) => {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, mdx, "utf-8");
}, toError);

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
  const categorize: Categorize = (name, pkg, tags) =>
    opts.categorize?.(name, pkg, tags) ?? defaultCategorize(name, pkg, tags);

  const parsed: { pkg: ApiPackage; symbols: DocSymbol[] }[] = [];
  for (const pkg of packages) {
    const extracted = extractExports(pkg.entry, pkg.name, categorize);
    if (isErr(extracted)) return extracted;
    parsed.push({ pkg, symbols: extracted.value });
  }

  const exports = new Map<string, ReadonlySet<string>>(
    parsed.map(({ pkg, symbols }) => [pkg.name, new Set(symbols.map((s) => s.name))]),
  );

  const written: string[] = [];
  for (const { pkg, symbols } of parsed) {
    const result = writeMdx(pkg.out, renderPackageMdx(pkg.name, symbols, exports, opts));
    if (isErr(result)) return result;
    written.push(pkg.out);
  }

  return ok(written);
};
