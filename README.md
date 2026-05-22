# onrails

Tagged `Result` / `ResultAsync` + railway-oriented utilities for TypeScript. Pure tagged unions, neverthrow-shaped compat shim, FL-friendly. Bun-first.

| Package | npm | Description |
|---|---|---|
| [`@onrails/result`](./packages/result) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fresult.svg)](https://www.npmjs.com/package/@onrails/result) | Core `Result` / `ResultAsync` + neverthrow compat shim |
| [`@onrails/maybe`](./packages/maybe) | — | Tagged `Maybe` for expected absence + `Result` interop |
| [`@onrails/pattern`](./packages/pattern) | — | Exhaustive matching for owned unions (ts-pattern-shaped, lighter) |
| [`@onrails/codemod`](./packages/codemod) | [![npm](https://img.shields.io/npm/v/%40onrails%2Fcodemod.svg)](https://www.npmjs.com/package/@onrails/codemod) | Bun script: migrate `neverthrow` imports + `package.json` deps to `@onrails/result/compat/neverthrow` |
| [`@onrails/eslint-plugin`](./packages/eslint-plugin) | [![npm](https://img.shields.io/npm/v/%40onrails%2Feslint-plugin.svg)](https://www.npmjs.com/package/@onrails/eslint-plugin) | ESLint rules for `@onrails/result` boundaries — flags `Promise<Result<…>>` + `_unsafeUnwrap*` |

[![CI](https://github.com/alanrsoares/onrails/actions/workflows/ci.yml/badge.svg)](https://github.com/alanrsoares/onrails/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Why

[Railway-oriented programming](https://fsharpforfunandprofit.com/rop/) — encode failure as values, chain ok/err down two parallel tracks, never throw across a public boundary.

`@onrails/result` is a small, tagged-union take on this pattern. The data is `{ _tag: "Ok"; value }` / `{ _tag: "Err"; error }` — no class wrapper, tree-shake friendly, Fantasy Land-aware. `@onrails/maybe` models expected absence (`Some` / `None`). `@onrails/pattern` exhaustively matches owned unions. A drop-in `compat/neverthrow` shim makes migration a regex search-and-replace.

## Quick start

```bash
bun add @onrails/result
```

```ts
import { err, flatMapResult, isErr, isOk, mapResult, match, ok, trySync } from "@onrails/result";

const parse = trySync(
  (raw: string) => JSON.parse(raw) as { v: number },
  (e) => ({ kind: "parse" as const, message: String(e) }),
);

const out = mapResult(parse('{"v":1}'), (data) => data.v + 1);

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

## Migrating from neverthrow

```bash
bunx @onrails/codemod /path/to/your-repo --dry
bunx @onrails/codemod /path/to/your-repo
```

See [`packages/result/README.md`](./packages/result/README.md#migration-from-neverthrow) for the compat surface and chain-by-chain mapping.

## Status

Experimental. Versions stay in `0.x` until the public API + compat surface settle. Released and tagged per-package via [release-please](https://github.com/googleapis/release-please-action).

## License

MIT — see [LICENSE](./LICENSE).
