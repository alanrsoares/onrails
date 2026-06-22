# @onrails/docgen

Generate MDX API-reference pages from TypeScript source + JSDoc/TSDoc, and
compile-check `@example` blocks against the real API.

> Snippet extraction lives in the companion [`@onrails/twoslash`](../twoslash)
> package.

The engine holds no onrails specifics — symbol categorization, category order,
and cross-package linking are passed in as options. The onrails configuration
lives in the runner (`scripts/generate-api-docs.ts`).

```bash
npm install -D @onrails/docgen   # peer: typescript >=6
```

## Usage

`generateApiDocs(packages, opts)` parses each package entrypoint, extracts its
exported symbols (signatures, JSDoc, `@param`/`@returns`/`@example`/`@deprecated`,
class members), and writes one MDX file per package. All packages are parsed
first to build a cross-package export map used for `{@link}` resolution.

```ts
import { generateApiDocs } from "@onrails/docgen";

generateApiDocs(
  [
    { entry: "packages/result/src/index.ts", name: "@onrails/result", out: "…/result.mdx" },
    { entry: "packages/maybe/src/index.ts", name: "@onrails/maybe", out: "…/maybe.mdx" },
  ],
  {
    // all optional — sensible defaults ship in the package
    categorize: (name, pkg, tags) => /* … */ undefined,
    categoryOrder: { "@onrails/result": ["Core", "Async", "Types"] },
    resolveLink: (symbol, currentPackage, exports) => /* … */ "#anchor",
  },
);
```

### Options

| Option | Default | Purpose |
| --- | --- | --- |
| `categorize` | reads `@category`, else `"Core"` | symbol → category |
| `categoryOrder` | alphabetical | preferred category order per package |
| `resolveLink` | local anchor → sibling page → local | resolve `{@link X}` targets |

The default renderer emits Fumadocs-flavored MDX with Tailwind-styled badges.

### Compile-checking examples

`checkExamples(packages, opts)` compiles every `@example` against the real
source and returns a `Result<CheckReport, Error>` — export/signature drift in a
doc example shows up as a build failure. Reporting and exit codes are the
caller's (see `scripts/check-api-examples.ts`).

```ts
import { checkExamples } from "@onrails/docgen";

const report = checkExamples(
  [{ entry: "packages/result/src/index.ts", name: "@onrails/result" }],
  {
    baseUrl: process.cwd(),
    paths: {
      "@onrails/result": ["packages/result/src/index.ts"],
      "@onrails/result/*": ["packages/result/src/*"],
    },
  },
);
```

## Develop

```bash
bun run --filter @onrails/docgen check   # typecheck + test
bun run --filter @onrails/docgen build   # tsup -> dist (esm + cjs + d.ts)
```
