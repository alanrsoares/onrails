# @onrails/docgen

Internal API-reference generator for the onrails documentation site. **Private**
— not published; consumed by the root `docs:generate` script.

> Snippet extraction moved to the published [`@onrails/twoslash`](../twoslash)
> package.

Turns TypeScript source + JSDoc/TSDoc into MDX API-reference pages. The engine
holds no onrails specifics — symbol categorization, category order, and
cross-package linking are passed in as options. The onrails configuration lives
in the runner (`scripts/generate-api-docs.ts`).

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

## Develop

```bash
bun run --filter @onrails/docgen check   # typecheck + test
```

The package runs from source via Bun (no build step). Output is verified by the
consuming gate: the root `docs:generate` writes the API MDX, and `apps/docs`
type-checks it on `predev`/`prebuild`.
