# @onrails/result — design

Typed `Result` / `ResultAsync` for railway-oriented TypeScript. Tagged unions, tree-shakeable, neverthrow-compat shim available.

## Runtime model

```ts
type Result<T, E> =
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E };
```

- Default API: dual-form module functions — every transform accepts either shape. The arity dispatch is owned by one internal combinator (`src/internal/dual.ts`, twin in `@onrails/maybe`); `test/dual.spec.ts` property-tests `f(r, x) ≡ f(x)(r)` for every transform:

  ```ts
  map(result, fn);    // data-first
  map(fn)(result);    // curried
  ```

  Dual functions: `map`, `mapErr`, `bimap`, `flatMap`, `recover`, `tap`, `tapErr`, `match`.

- `flatMap` is the canonical bind and widens error types (`E | F`).
- `match` is the canonical terminal collapse — positional, dual-form.
- House style: `import * as R from "@onrails/result"`. `R.` autocompletes the full surface (data-first's one ergonomic debit) and sidesteps name collisions — most commonly `match` from `ts-pattern` or `@onrails/pattern` (`R.match` next to `P.matchTag`).
- `of` is the Fantasy Land `pure` alias of `ok`, mirrored by `ResultAsync.of` (`Maybe.of` follows in RFC 0002); `show(r)` prints `Ok(…)` / `Err(…)` for logs (fluent's `toString` delegates to it).
- `tap` / `tapErr` observe a track without changing the carried value.
- `recover` binds the error track and may return a failed workflow back to success.
- `pipe(value, ...fns)` is the variadic value-first pipe (up to 9 steps); `flow(...fns)` is the variadic point-free composition in `@onrails/result/pipe`.
- Optional dot-chaining via `fluent(r)` in `@onrails/result/fluent`. Mirrors every instance-appropriate core transform; `test/parity.spec.ts` enforces the mirror (both directions) across core, fluent, and the neverthrow compat shim. `ResultAsync` is already fluent (its methods return `ResultAsync`) — no `fluentAsync` wrapper; wrapping it would just be a one-line delegate to itself.
- The fluent wrapper stays local: `fluent(r)` opens and a terminal (`toResult`/`toString`/`match`/`unwrapOr`) closes within one expression — it's a closure over data, not data, so it must never be a return type, an exported binding, a stored field, or an argument to a serialize/`postMessage`/cache call. `@onrails/eslint-plugin` and `@onrails/biome-plugin` enforce this via `fluent-stays-local` (RFC 0002 §9).

## Sync / async interop

Two distinct lift paths:

- `fromResult(result)` — already-known sync `Result<T, E>`. Cannot defect, so returns `ResultAsync<T, E>` without widening.
- `fromAsync(fn)` / `ResultAsync.fromResultPromise(promise)` — `Promise<Result<T, E>>` boundary. The promise can reject outside the `Result` channel, so the error widens with `UnexpectedError` unless a custom defect mapper is supplied.

`asyncAfter(result, fn)` bridges sync validation into async IO:

```ts
asyncAfter(
  trySync(() => Schema.parse(input), toError)(),
  (value) => tryAsync(save(value)),
);
```

`tryAsync(promise, onReject?)` wraps Promise boundaries with default `Error` normalization.

## Railway workflows

`Railway<C, E, M>` (`@onrails/result/railway`) is a named-context builder for service-layer ETL.

- `Railway.fromSync`, `.fromResult`, `.derive` preserve sync mode.
- `.fromPromise`, `.fromAsync`, `.parallel` upgrade to async mode.
- `.require(key, source, onMissing)` converts a nullable context field into a required non-null field.
- `.parallel(record)` runs independent `ResultAsync` branches concurrently and merges named outputs back into context. On multiple failures, the first `Err` in record iteration order wins.
- `.select(fn)` projects the final context.

Return type is mode-aware:

```ts
type RailwayOutput<T, E, M extends RailwayMode> =
  M extends "async" ? ResultAsync<T, E> : Result<T, E>;
```

Use `Railway` when named context removes nesting or positional tuple plumbing. Prefer `asyncAfter`, `fromResult`, or direct `flatMap` for one- or two-step flows. Reusable steps are plain functions of the context (`(ctx) => Result` / `(ctx) => ResultAsync`) plugged in via `.fromResult` / `.fromAsync`.

Internally the runtime state tag (`"sync" | "async"`) mirrors the phantom `M`; the private `step`/`out` helpers are the only places that re-link the two.

## Combining results

One module (`collections.ts`), one naming matrix — short-circuit vs accumulate × array vs tuple:

- `combine` / `combineTuple` — sync, first-Err wins.
- `validateAll` / `validateTuple` — accumulate independent failures; optional `combineErrors` fold, default collects a `readonly E[]`.
- `ResultAsync.combine` / `ResultAsync.combineTuple` — async, sequential, first-Err in input order.
- `ResultAsync.combineTupleParallel` — async, concurrent (branches overlap), first-Err in input order.

Use `flatMap` for dependent checks where later checks need earlier successful values.

## Errors

- `E` is fully generic on the core package.
- `@onrails/result/extra` — `errOf`, `unionErrors`, `mapErrKind`, `declareErrors`, `AccumulateErrors` for discriminated unions.

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/result` | Core: dual-form map/flatMap/match, variadic `pipe`, sync collection, async surface, lift helpers, generator sugar |
| `@onrails/result/fluent` | Dot-style chains |
| `@onrails/result/extra` | Error-type utilities |
| `@onrails/result/pipe` | Variadic `flow` for point-free composition |
| `@onrails/result/railway` | Named workflow builder |
| `@onrails/result/try-gen` | Sync generator-style `Result` sugar |
| `@onrails/result/compat/neverthrow` | Migration shim — class-shaped surface for incremental migration off neverthrow |

## Type tests

`test/types.spec.ts` — `ts-expect` (`expectType` + `TypeEqual`).

## v1.0 gate

- bun tests: core ops, FL functor/monad laws (sync), neverthrow-compat fixtures.
- README with tagged-error guidance.
- **Not** in v1.0: npm publish.

## Deferred

- npm publish visibility.
- `ap` / `alt` / error `Semigroup`.
