// API reference (TS AST + JSDoc -> MDX).
// Snippet extraction lives in the published @onrails/twoslash package.

export type {
  CheckExamplesOptions,
  CheckReport,
  ExampleFailure,
  ExamplePackage,
} from "./api/check.js";
export { checkExamples } from "./api/check.js";
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
