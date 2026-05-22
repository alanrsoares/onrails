# @onrails/maybe — design

Expected absence as a tagged union — not failure. Pairs with `@onrails/result` at boundaries.

## Goals

- Same runtime model as `@onrails/result`: `{ _tag }` variants, module functions, `sideEffects: false`
- **Some / None** — not Ok/Err; do not use Maybe for parse/IO/auth failures
- Optional `@onrails/result/interop` bridge (`toResult`, `fromResult`)

## Runtime model

```ts
type Maybe<T> =
  | { readonly _tag: "Some"; readonly value: T }
  | { readonly _tag: "None" };
```

## API parity with `@onrails/result`

| Result | Maybe |
|--------|-------|
| `ok` / `err` | `some` / `none` |
| `of` | `of` (= `some`) |
| `map` / `mapResult` | `map` / `mapMaybe` |
| `flatMap` / `andThen` | `flatMap` / `andThen` |
| `match` | `match` (`{ some, none }` handlers) |
| `unwrapOr` | `unwrapOr` (= `getOrElse`) |

## vs RecallOS `Maybe`

RecallOS used `Result<T, None>` via neverthrow compat. This package is a **standalone** optional type with the same ergonomics (`fromNullable`, `match`, `compact`, `toResult`) and onrails `_tag` naming.

## Type tests

`test/types.spec.ts` uses `ts-expect` (`expectType` + `TypeEqual`) like styled-cva — compile-time assertions, no runtime cost.

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/maybe` | Core |
| `@onrails/maybe/fluent` | Dot-style chains |
| `@onrails/maybe/interop` | `Result` bridge (peer: `@onrails/result`) |

## Deferred

- `compat` shim for RecallOS `Result<T, None>` call sites
- Fantasy Land instances
