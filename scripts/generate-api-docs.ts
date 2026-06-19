#!/usr/bin/env bun
/**
 * onrails config for the `@onrails/docgen` API-reference generator.
 *
 * The engine (TS AST -> MDX) is project-agnostic. This runner supplies the
 * onrails specifics: which packages to document, how to categorize symbols
 * (the source has no `@category` tags, so categories are derived by name), and
 * how `{@link}` targets resolve across the three packages.
 */
import { generateApiDocs, slugify, type ExportsByPackage, type SymbolKind } from "@onrails/docgen";
import { isErr } from "@onrails/result";
import ts from "typescript";

// Single source of truth for categories: ordered category -> the base symbols
// it owns, per package. Key order IS the doc order; membership IS the
// categorization. The one empty-list bucket per package is the catch-all
// (everything not listed elsewhere lands there).
const CATEGORIES: Record<string, Record<string, readonly string[]>> = {
  "@onrails/result": {
    Core: [],
    Async: [
      "ResultAsync",
      "fromPromise",
      "fromSafePromise",
      "parallelTupleAsync",
      "tryAsync",
      "okAsync",
      "errAsync",
    ],
    Collections: ["combine", "combineTuple"],
    Interop: ["fromResult", "fromAsync", "asyncAfter"],
    Generators: ["$", "tryGen", "yieldResult"],
    Types: ["Result", "Ok", "Err", "UnexpectedError", "InferOk", "InferErr"],
  },
  "@onrails/maybe": {
    Constructors: ["some", "none"],
    Core: [],
    Collections: ["compact", "compactMap"],
    Utilities: ["optional", "fromNullable"],
    Types: ["Maybe", "Some", "None"],
  },
  "@onrails/pattern": {
    Matching: ["match", "MatchBuilder", "matchTag", "when"],
    Diagnostics: ["assertNever", "NonExhaustiveError"],
    Types: [],
  },
};

// Both derived from CATEGORIES so they can't drift from the membership table.
const categoryOrder: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(CATEGORIES).map(([pkg, buckets]) => [pkg, Object.keys(buckets)]),
);
const defaultCategory: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORIES).map(([pkg, buckets]) => [
    pkg,
    Object.entries(buckets).find(([, names]) => names.length === 0)?.[0] ?? "Core",
  ]),
);

const categorize = (name: string, packageName: string, tags: readonly ts.JSDocTagInfo[]): string => {
  const explicit = tags.find((t) => t.name === "category");
  if (explicit) return ts.displayPartsToString(explicit.text).trim();
  // result's ResultAsync.* members categorize by prefix, not by listed name.
  if (packageName === "@onrails/result" && name.startsWith("ResultAsync.")) return "Async";
  const buckets = CATEGORIES[packageName] ?? {};
  for (const [category, names] of Object.entries(buckets)) {
    if (names.includes(name)) return category;
  }
  return defaultCategory[packageName] ?? "Core";
};

// Cross-package `{@link}` targets. Each set lists the symbols a package owns;
// a link to a symbol owned by another package points at that package's page.
const RESULT_SYMBOLS = new Set([
  "Result",
  "Ok",
  "Err",
  "ResultAsync",
  "ok",
  "err",
  "map",
  "flatMap",
  "match",
  "bimap",
  "mapErr",
  "trySync",
  "tryAsync",
]);
const MAYBE_SYMBOLS = new Set([
  "Maybe",
  "Some",
  "None",
  "some",
  "none",
  "isSome",
  "isNone",
  "fromNullable",
  "unwrapOr",
]);
const PATTERN_SYMBOLS = new Set(["match", "MatchBuilder", "assertNever", "matchTag", "when"]);

const resolveLink = (symbol: string, currentPackage: string, exports: ExportsByPackage): string => {
  let targetPackage = currentPackage;
  if (currentPackage === "@onrails/maybe") {
    if (RESULT_SYMBOLS.has(symbol)) targetPackage = "@onrails/result";
    else if (PATTERN_SYMBOLS.has(symbol)) targetPackage = "@onrails/pattern";
  } else if (currentPackage === "@onrails/result") {
    if (MAYBE_SYMBOLS.has(symbol)) targetPackage = "@onrails/maybe";
    else if (PATTERN_SYMBOLS.has(symbol)) targetPackage = "@onrails/pattern";
  } else if (currentPackage === "@onrails/pattern") {
    if (RESULT_SYMBOLS.has(symbol)) targetPackage = "@onrails/result";
    else if (MAYBE_SYMBOLS.has(symbol)) targetPackage = "@onrails/maybe";
  }

  const kind = exports.get(targetPackage)?.get(symbol);
  const label = kind ? (kind === "function" ? "ƒ" : kind) : undefined;
  const slugText = label ? `${symbol} ${label}` : symbol;
  const slug = slugify(slugText);

  if (targetPackage === currentPackage) return `#${slug}`;
  const shortName = targetPackage.split("/").pop() ?? targetPackage;
  return `./${shortName}#${slug}`;
};

const result = generateApiDocs(
  [
    {
      entry: "packages/result/src/index.ts",
      name: "@onrails/result",
      out: "apps/docs/content/docs/api/result.mdx",
    },
    {
      entry: "packages/maybe/src/index.ts",
      name: "@onrails/maybe",
      out: "apps/docs/content/docs/api/maybe.mdx",
    },
    {
      entry: "packages/pattern/src/index.ts",
      name: "@onrails/pattern",
      out: "apps/docs/content/docs/api/pattern.mdx",
    },
  ],
  { categorize, categoryOrder, resolveLink },
);

if (isErr(result)) {
  console.error(result.error.message);
  process.exit(1);
}

for (const out of result.value) console.log(`Generated ${out}`);
