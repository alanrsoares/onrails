# onrails

Tagged `Result` / `ResultAsync` + railway-oriented utilities for TypeScript. Pure tagged unions, neverthrow-shaped compat shim, FL-friendly. Bun-first.

| Package | npm | Description |
|---|---|---|
| [`@onrails/result`](./packages/result) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fresult.svg)](https://www.npmjs.com/package/@onrails/result) | Core `Result` / `ResultAsync` + neverthrow compat shim |
| [`@onrails/maybe`](./packages/maybe) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fmaybe.svg)](https://www.npmjs.com/package/@onrails/maybe) | Tagged `Maybe` for expected absence + `Result` interop |
| [`@onrails/pattern`](./packages/pattern) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fpattern.svg)](https://www.npmjs.com/package/@onrails/pattern) | Exhaustive matching for owned unions (ts-pattern-shaped, lighter) |
| [`@onrails/codemod`](./packages/codemod) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fcodemod.svg)](https://www.npmjs.com/package/@onrails/codemod) | Bun script: migrate `neverthrow` imports + `package.json` deps to `@onrails/result/compat/neverthrow` |
| [`@onrails/eslint-plugin`](./packages/eslint-plugin) | [![npm](https://img.shields.io/npm/v/%40onrails%2Feslint-plugin.svg)](https://www.npmjs.com/package/@onrails/eslint-plugin) | ESLint rules for `@onrails/result` boundaries — flags `Promise<Result<…>>` + `_unsafeUnwrap*` |
| [`@onrails/biome-plugin`](./packages/biome-plugin) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fbiome-plugin.svg)](https://www.npmjs.com/package/@onrails/biome-plugin) | GritQL plugin: same boundary rules for Biome users |
| [`@onrails/twoslash`](./packages/twoslash) | [![npm](https://img.shields.io/npm/v/%40onrails%2Ftwoslash.svg)](https://www.npmjs.com/package/@onrails/twoslash) | Extract `#region` snippets from tested source into display + twoslash forms for docs |

[![Docs](https://img.shields.io/badge/docs-online-blue)](https://alanrsoares.github.io/onrails/)
[![CI](https://github.com/alanrsoares/onrails/actions/workflows/ci.yml/badge.svg)](https://github.com/alanrsoares/onrails/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

📚 **API reference**: [alanrsoares.github.io/onrails](https://alanrsoares.github.io/onrails/) — generated from tsdoc on every push to `main`.

## Why

[Railway-oriented programming](https://fsharpforfunandprofit.com/rop/) — encode failure as values, chain ok/err down two parallel tracks, never throw across a public boundary.

`@onrails/result` is a small, tagged-union take on this pattern. The data is `{ _tag: "Ok"; value }` / `{ _tag: "Err"; error }` — no class wrapper, tree-shake friendly, Fantasy Land-aware. `@onrails/maybe` models expected absence (`Some` / `None`). `@onrails/pattern` exhaustively matches owned unions. A drop-in `compat/neverthrow` shim makes migration a regex search-and-replace.

## Quick start

```bash
bun add @onrails/result
```

```ts
import { err, flatMap, isErr, isOk, map, match, ok, trySync } from "@onrails/result";

const parse = trySync(
  (raw: string) => JSON.parse(raw) as { v: number },
  (e) => ({ kind: "parse" as const, message: String(e) }),
);

const out = map(parse('{"v":1}'), (data) => data.v + 1);

if (isOk(out)) console.log(out.value);
else console.error(out.error);
```

Async, with a thenable `ResultAsync`:

```ts
import { fromAsync, isOk, ok, err } from "@onrails/result";

const fetchUser = fromAsync(async () => {
  const res = await fetch("/api/user");
  return res.ok ? ok(await res.json()) : err({ kind: "http" as const, status: res.status });
});

const r = await fetchUser();   // bare tagged Result
if (isOk(r)) console.log(r.value);
```

For composition patterns (`pipe`, `flow`, dual-form transforms, point-free pipelines) see [`packages/result/RECIPES.md`](./packages/result/RECIPES.md).

## Composition guidelines

To keep codebases readable and consistent, follow the four-tier guideline when choosing how to compose operations:

| Tier | Use Case | Recommended Pattern |
| ---- | -------- | ------------------- |
| **1** | 1–2 steps, linear | direct data-first calls or method chains |
| **2** | 3+ steps, linear | `pipe` or `flow` |
| **3** | branchy, value reused | `tryGen` escape hatch |
| **4** | 4+ named steps, mixed IO | `Railway` builder |

`/fluent` is documented as app-edge sugar only — never in library or service internals. For examples illustrating Tier 1-4 usage patterns, see [`packages/result/RECIPES.md`](./packages/result/RECIPES.md).

## Agent skills

`@onrails/result` ships [Agent Skills](https://tanstack.com/intent) under `packages/result/skills/`, versioned with the package and auto-discovered via [`@tanstack/intent`](https://github.com/TanStack/intent):

- **`result-composition`** — primitive composition, dual-form currying, pipe/flow.
- **`railway-do-notation`** — named-context workflows with the Railway builder.

Once `@onrails/result` is a dependency, wire the skills into your agent config (`AGENTS.md` / `CLAUDE.md`) and load them on demand:

```bash
npx @tanstack/intent@latest install        # add skill-loading guidance to your agent config
npx @tanstack/intent@latest list           # discover skills across your dependencies
npx @tanstack/intent@latest load @onrails/result#result-composition
npx @tanstack/intent@latest load @onrails/result#railway-do-notation
```

## Migrating from neverthrow

```bash
bunx @onrails/codemod /path/to/your-repo --dry
bunx @onrails/codemod /path/to/your-repo
```

See [`packages/result/README.md`](./packages/result/README.md#migration-from-neverthrow) for the compat surface and chain-by-chain mapping.

Once the compat shim compiles, start the native migration:

```bash
bunx @onrails/codemod /path/to/your-repo --to-native --dry
```

This rewrites safe compat imports to `@onrails/result` and reports TODO lines
for compat-only method chains that need manual or future AST-codemod follow-up.

## Status

Experimental. Versions stay in `0.x` until the public API + compat surface settle. Released and tagged per-package via [release-please](https://github.com/googleapis/release-please-action).

## License

MIT — see [LICENSE](./LICENSE).
