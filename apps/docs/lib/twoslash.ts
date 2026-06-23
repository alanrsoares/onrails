import { resolve } from "node:path";
import ts from "typescript";

// Resolve @onrails/* to source (not built dist) so hover types never go stale.
// Shared by the MDX pipeline (source.config.ts) and the server-rendered
// frontpage snippets (components/twoslash-snippet.tsx). Build/codegen always
// run from apps/docs, so the repo root is two levels up. (Avoid
// `new URL(import.meta.url)` here — the bundler treats it as an asset import.)
const repoRoot = resolve(process.cwd(), "../..");

/**
 * Repairs the JSDoc markdown twoslash hands to the hover renderer.
 *
 * TypeScript splits an inline `{@link X}` tag into three separate
 * `SymbolDisplayPart`s (`"{@link "`, `"X"`, `"}"`); twoslash core joins doc
 * parts with `"\n"`, so the tag arrives as `"{@link \nX\n}"` — and the source
 * line break that often precedes a link adds a second `"\n"`. fumadocs then
 * strips the braces, leaving `"\n\nX\n\n"`: a blank line markdown turns into a
 * paragraph break. The result is one `<p>` per fragment, so a sentence like
 * "...call {@link resolve} / {@link match} to settle it." renders as a column
 * of single words instead of flowing prose, blowing out the popup layout.
 *
 * Collapse each link (and the newline artifacts hugging it) back into an inline
 * `code` reference before fumadocs' renderer sees it. Wired in via
 * `rendererRich.processHoverDocs`, so fumadocs' own markdown/code rendering
 * stays intact — it just runs on the cleaned-up string.
 */
export function processHoverDocs(docs: string): string {
  return docs
    .replace(
      /[ \t]*\n*[ \t]*\{@link\s+([^}]*?)\s*\}[ \t]*\n*[ \t]*/g,
      (_match, name: string) => ` \`${name.trim()}\` `,
    )
    .replace(/[ \t]+([,.;:)])/g, "$1")
    .replace(/(\()[ \t]+/g, "$1")
    .trim();
}

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
