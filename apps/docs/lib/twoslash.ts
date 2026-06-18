import { resolve } from "node:path";
import ts from "typescript";

// Resolve @onrails/* to source (not built dist) so hover types never go stale.
// Shared by the MDX pipeline (source.config.ts) and the server-rendered
// frontpage snippets (components/twoslash-snippet.tsx). Build/codegen always
// run from apps/docs, so the repo root is two levels up. (Avoid
// `new URL(import.meta.url)` here — the bundler treats it as an asset import.)
const repoRoot = resolve(process.cwd(), "../..");

export const twoslashCompilerOptions = {
  baseUrl: repoRoot,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
  strict: true,
  paths: {
    "@onrails/result": ["packages/result/src/index.ts"],
    "@onrails/result/*": ["packages/result/src/*"],
    "@onrails/maybe": ["packages/maybe/src/index.ts"],
    "@onrails/maybe/*": ["packages/maybe/src/*"],
    "@onrails/pattern": ["packages/pattern/src/index.ts"],
  },
};
