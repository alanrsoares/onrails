#!/usr/bin/env bun
/**
 * onrails config for the `@onrails/docgen` API-reference generator.
 *
 * The engine (TS AST -> MDX) is project-agnostic. This runner supplies the
 * onrails specifics: which packages to document, how to categorize symbols
 * (the source has no `@category` tags, so categories are derived by name), the
 * preferred category order, and how `{@link}` targets resolve across the three
 * packages.
 */
import { generateApiDocs } from "@onrails/docgen";
import ts from "typescript";

// Symbol -> category, by package. Falls through to "Core". An explicit
// `@category` tag (none today) always wins.
const categorize = (
  name: string,
  packageName: string,
  tags: readonly ts.JSDocTagInfo[],
): string => {
  const catTag = tags.find((t) => t.name === "category");
  if (catTag) return ts.displayPartsToString(catTag.text).trim();

  if (packageName === "@onrails/result") {
    const isAsync =
      [
        "ResultAsync",
        "fromPromise",
        "fromSafePromise",
        "parallelTupleAsync",
        "tryAsync",
        "okAsync",
        "errAsync",
      ].includes(name) || name.startsWith("ResultAsync.");
    if (isAsync) return "Async";
    if (["combine", "combineTuple"].includes(name)) return "Collections";
    if (["fromResult", "fromAsync", "asyncAfter"].includes(name)) return "Interop";
    if (["$", "tryGen", "yieldResult"].includes(name)) return "Generators";
    if (["Result", "Ok", "Err", "UnexpectedError", "InferOk", "InferErr"].includes(name)) {
      return "Types";
    }
    return "Core";
  }

  if (packageName === "@onrails/maybe") {
    if (["some", "none"].includes(name)) return "Constructors";
    if (["Maybe", "Some", "None"].includes(name)) return "Types";
    if (["compact", "compactMap"].includes(name)) return "Collections";
    if (["optional", "fromNullable"].includes(name)) return "Utilities";
    return "Core";
  }

  if (packageName === "@onrails/pattern") {
    if (["assertNever", "NonExhaustiveError"].includes(name)) return "Diagnostics";
    if (["match", "MatchBuilder", "matchTag", "when"].includes(name)) return "Matching";
    return "Types";
  }

  return "Core";
};

const categoryOrder: Record<string, readonly string[]> = {
  "@onrails/result": ["Core", "Async", "Collections", "Interop", "Generators", "Types"],
  "@onrails/maybe": ["Constructors", "Core", "Collections", "Utilities", "Types"],
  "@onrails/pattern": ["Matching", "Diagnostics", "Types"],
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

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-");

const resolveLink = (symbol: string, currentPackage: string): string => {
  const slug = slugify(symbol);
  if (currentPackage === "@onrails/maybe") {
    if (RESULT_SYMBOLS.has(symbol)) return `./result#${slug}`;
    if (PATTERN_SYMBOLS.has(symbol)) return `./pattern#${slug}`;
  } else if (currentPackage === "@onrails/result") {
    if (MAYBE_SYMBOLS.has(symbol)) return `./maybe#${slug}`;
    if (PATTERN_SYMBOLS.has(symbol)) return `./pattern#${slug}`;
  } else if (currentPackage === "@onrails/pattern") {
    if (RESULT_SYMBOLS.has(symbol)) return `./result#${slug}`;
    if (MAYBE_SYMBOLS.has(symbol)) return `./maybe#${slug}`;
  }
  return `#${slug}`;
};

generateApiDocs(
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
