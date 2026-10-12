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

## Prototype carriers (breaking)

`ok` / `err` return live carriers: `_tag` plus `value` / `error` as own enumerable properties, with `map`, `mapErr`, `flatMap`/`andThen`, `recover`, `tap`, `tapErr`, `match` and `unwrapOr` on a shared non-enumerable prototype (`src/internal/proto.ts`). `r.map(f).flatMap(g)` works on any core `Result`, with core semantics (`tap` propagates throws, `recover` keeps `T`). The neverthrow-semantics names (`andTee`, `orElse`, ...) stay in compat.

- **Serialization:** `JSON.stringify` output is unchanged (same keys, same order). `JSON.parse`, `structuredClone`, spread and `postMessage` return plain data without the methods, while the type still claims them. Lift at every such sink with `Result.from`. `ResultData<T, E>` is the plain shape `from` accepts. Suite `test/prototype-core.spec.ts` covers all four routes.
- **Literals:** a hand-written `{ _tag: "Ok", value }` is no longer a `Result` (it lacks the methods). `onrails-codemod --literals` rewrites them to `ok` / `err`.
- **Narrowed branches:** `Err<T, E>` now carries `T` through its methods, so returning a narrowed `Err` as a `Result` with a different `T` needs `err(r.error)` (the same as neverthrow).
- **Redux, immer:** carriers are not plain objects (prototype is not `Object.prototype`). Redux Toolkit's serializability check flags them, and immer will not draft them. Store `ResultData` (or call `Result.from` on read) and convert at the edge.
- **Compat shim:** `CompatResult` still wraps a core carrier (`inner`) and now delegates `map`, `mapErr`, `andThen` and `unwrapOr` to the prototype methods. It cannot collapse into the core carrier: its semantics differ by design (`orElse` widens, `andTee` swallows throws, `value` / `error` getters throw), and the differential suite (`neverthrow-diff.spec.ts`) pins exactly that.
- **Packages:** `result` does not know `maybe`. `Maybe` has the mirrored prototype and `Maybe.from`; `toResult` / `fromResult` stay in `@onrails/maybe/interop`.

## Sync / async interop

Two distinct lift paths:

- `fromResult(result)` — already-known sync `Result<T, E>`. Cannot defect, so returns `ResultAsync<T, E>` without widening.
- `fromAsync(fn)` / `ResultAsync.fromResultPromise(promise)` — `Promise<Result<T, E>>` boundary. The promise can reject outside the `Result` channel, so the error widens with `UnexpectedError` unless a custom defect mapper is supplied.

`asyncAfter(result, fn)` bridges sync validation into async IO:

```ts
asyncAfter(
  trySync(() => Schema.parse(input), toError),
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

- bun tests: core ops, functor/monad/error-functor laws on `Result` and `ResultAsync` (`test/result.laws.spec.ts`), JSON and `structuredClone` round-trips, and a neverthrow differential (`test/neverthrow-diff.spec.ts`): a surface diff against the installed package plus randomised op chains run through both libraries.
- README with tagged-error guidance.
- **Not** in v1.0: npm publish.

## Deferred

- npm publish visibility.
- `ap` / `alt` / error `Semigroup`.
