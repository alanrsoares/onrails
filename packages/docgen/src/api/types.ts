import type ts from "typescript";

export type SymbolKind = "function" | "type" | "class" | "other";

export interface DocParam {
  name: string;
  type: string;
  description: string;
}

export interface DocSymbol {
  name: string;
  kind: SymbolKind;
  signature: string;
  description: string;
  examples: string[];
  params: DocParam[];
  returns: string;
  category: string;
  isDeprecated: boolean;
  deprecationMessage: string;
  // Class-specific fields.
  constructorSig?: string;
  staticMethods?: DocSymbol[];
  instanceMethods?: DocSymbol[];
}

export interface ApiPackage {
  /** Path to the package entrypoint, e.g. `packages/result/src/index.ts`. */
  entry: string;
  /** Display name and frontmatter title, e.g. `@onrails/result`. */
  name: string;
  /** Output MDX path, e.g. `apps/docs/content/docs/api/result.mdx`. */
  out: string;
}

/** Maps each package name to the set of symbol names it exports. */
export type ExportsByPackage = ReadonlyMap<string, ReadonlyMap<string, SymbolKind>>;

export interface ApiDocsOptions {
  /**
   * Resolve a symbol's category. Receives the JSDoc tags so a custom strategy
   * can still honor `@category`. Return `undefined` to fall back to the default
   * (reads `@category`, else `"Core"`).
   */
  categorize?: (
    name: string,
    packageName: string,
    tags: readonly ts.JSDocTagInfo[],
  ) => string | undefined;
  /** Preferred category ordering per package name; unlisted categories sort last, alphabetically. */
  categoryOrder?: Record<string, readonly string[]>;
  /**
   * Resolve a `{@link X}` target to a URL or anchor. Default: local anchor when
   * the current package exports the symbol, else a sibling-package link, else a
   * local anchor.
   */
  resolveLink?: (symbol: string, currentPackage: string, exports: ExportsByPackage) => string;
}
