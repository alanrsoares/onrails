# @onrails/maybe — design

Expected absence as a tagged union — not failure. Pairs with `@onrails/result` at boundaries.

## Goals

- Same runtime model as `@onrails/result`: `{ _tag }` variants, dual-form module functions, `sideEffects: false`.
- Cross-carrier symmetry is spec-enforced (`test/symmetry.spec.ts`): shared ops keep the same name and dual arity as result's; channels mirror (`tapErr` ↔ `tapNone`); deliberate gaps are declared there. `of` = FL `pure` (alias of `some`); `show(m)` prints `Some(…)` / `None`.
- House style: `import * as Maybe from "@onrails/maybe"`, same rationale as `@onrails/result`'s `import * as R` — full-surface autocomplete, no name collisions.
- `fluent(m)` in `@onrails/maybe/fluent` mirrors `@onrails/result/fluent`'s bracket rule: opens with `fluent(...)`, closes with a terminal (`toMaybe`/`toString`/`match`/`unwrapOr`) in the same expression, never escapes as a return type, export, stored field, or serialize-sink argument. Enforced by `fluent-stays-local` in both lint plugins.
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

## Prototype carriers (breaking)

`some` / `none` return live carriers with `map`, `flatMap`/`andThen`, `match`, `unwrapOr`, `tap` and `tapNone` on a shared non-enumerable prototype (`src/internal/proto.ts`); `_tag` and `value` stay own enumerable properties, so JSON output is unchanged. After `JSON.parse`, `structuredClone`, spread or `postMessage`, lift plain data with `Maybe.from` (`MaybeData<T>` is its input). Hand-written `{ _tag: "Some", value }` literals are no longer a `Maybe`; `onrails-codemod --literals` rewrites them. The same Redux/immer caveats as `@onrails/result` apply (see its DESIGN).
