import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isErr, ok, type Result, trySync } from "@onrails/result";
import { type Categorize, defaultCategorize, extractExports } from "./extract.js";
import { renderPackageMdx } from "./render.js";
import type { ApiDocsOptions, ApiPackage, DocSymbol } from "./types.js";

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

// fs writes are a boundary — a safe, Result-returning writer.
const writeMdx = trySync((out: string, mdx: string) => {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, mdx, "utf-8");
}, toError);

/**
 * Generate API-reference MDX for each package from its TypeScript source +
 * JSDoc/TSDoc. Parses every package first to build a cross-package export map
 * (used by `{@link}` resolution), then renders and writes each file. Returns
 * `err` on the first package that fails to parse or write.
 */
export const generateApiDocs = (
  packages: readonly ApiPackage[],
  opts: ApiDocsOptions = {},
): Result<void, Error> => {
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

  for (const { pkg, symbols } of parsed) {
    const mdx = renderPackageMdx(pkg.name, symbols, exports, opts);
    const written = writeMdx(pkg.out, mdx);
    if (isErr(written)) return written;
    console.log(`Generated docs for ${pkg.name} -> ${pkg.out}`);
  }

  return ok(undefined);
};
