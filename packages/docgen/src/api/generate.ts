import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type Categorize, defaultCategorize, extractExports } from "./extract.js";
import { renderPackageMdx } from "./render.js";
import type { ApiDocsOptions, ApiPackage } from "./types.js";

/**
 * Generate API-reference MDX for each package from its TypeScript source +
 * JSDoc/TSDoc. Parses every package first to build a cross-package export map
 * (used by `{@link}` resolution), then renders and writes each file.
 */
export const generateApiDocs = (
  packages: readonly ApiPackage[],
  opts: ApiDocsOptions = {},
): void => {
  const categorize: Categorize = (name, pkg, tags) =>
    opts.categorize?.(name, pkg, tags) ?? defaultCategorize(name, pkg, tags);

  const parsed = packages.map((pkg) => ({
    pkg,
    symbols: extractExports(pkg.entry, pkg.name, categorize),
  }));

  const exports = new Map<string, ReadonlySet<string>>(
    parsed.map(({ pkg, symbols }) => [pkg.name, new Set(symbols.map((s) => s.name))]),
  );

  for (const { pkg, symbols } of parsed) {
    const mdx = renderPackageMdx(pkg.name, symbols, exports, opts);
    mkdirSync(dirname(pkg.out), { recursive: true });
    writeFileSync(pkg.out, mdx, "utf-8");
    console.log(`Generated docs for ${pkg.name} -> ${pkg.out}`);
  }
};
