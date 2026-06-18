// Snippet extraction (region -> display + twoslash forms).

// API reference (TS AST + JSDoc -> MDX).
export { defaultCategorize, extractExports } from "./api/extract.js";
export { generateApiDocs } from "./api/generate.js";
export { defaultResolveLink, renderPackageMdx, slugify } from "./api/render.js";
export type {
  ApiDocsOptions,
  ApiPackage,
  DocParam,
  DocSymbol,
  ExportsByPackage,
  SymbolKind,
} from "./api/types.js";
export type {
  BuildResult,
  ExtractResult,
  ExtractSnippetsOptions,
  SnippetForms,
} from "./snippets.js";
export { buildSnippetsModule, extractSnippets } from "./snippets.js";
