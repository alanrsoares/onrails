# @onrails/maybe — design

Expected absence as a tagged union — not failure. Pairs with `@onrails/result` at boundaries.

## Goals

- Same runtime model as `@onrails/result`: `{ _tag }` variants, dual-form module functions, `sideEffects: false`.
- **Some / None** — not Ok/Err. Do not use Maybe for parse/IO/auth failures.
- Optional `@onrails/maybe/interop` bridge (`toResult`, `fromResult`) keyed on `@onrails/result`.

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
| `map` (dual) | `map` (dual) |
| `flatMap` (dual) | `flatMap` (dual) |
| `match` (positional, dual) | `match` (positional, dual) |
| `unwrapOr` | `unwrapOr` |
| — | `compactMap` (`compact` ∘ `map`) |
| — | `optional` (`flatMap` ∘ `fromNullable`) |

## Type tests

`test/types.spec.ts` uses `ts-expect` (`expectType` + `TypeEqual`) — compile-time assertions, no runtime cost.

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/maybe` | Core |
| `@onrails/maybe/fluent` | Dot-style chains |
| `@onrails/maybe/interop` | `Result` bridge (peer: `@onrails/result`) |

## Deferred

- Fantasy Land instances.
