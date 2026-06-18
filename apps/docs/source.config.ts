import { fileURLToPath } from "node:url";
import { rehypeCodeDefaultOptions } from "fumadocs-core/mdx-plugins";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { transformerTwoslash } from "fumadocs-twoslash";
import ts from "typescript";

// Resolve @onrails/* to source (not built dist) so hover types never go stale.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      ...rehypeCodeDefaultOptions,
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash({
          twoslashOptions: {
            compilerOptions: {
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
            },
          },
        }),
      ],
    },
  },
});
