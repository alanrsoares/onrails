# @onrails/result — design

Typed `Result` / `ResultAsync` for railway-oriented TypeScript. Tagged unions, tree-shakeable, neverthrow-compat shim available.

## Runtime model

```ts
type Result<T, E> =
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E };
```

- Default API: dual-form module functions — every transform accepts either shape:

  ```ts
  map(result, fn);    // data-first
  map(fn)(result);    // curried
  ```

  Dual functions: `map`, `mapErr`, `bimap`, `flatMap`, `recover`, `tap`, `tapErr`, `match`.

- `flatMap` is the canonical bind and widens error types (`E | F`).
- `match` is the canonical terminal collapse — positional, dual-form.
- `fold({ ok, err })(result)` is the curried named-slot escape valve when positional `match` order is ambiguous at the call site.
- `tap` / `tapErr` observe a track without changing the carried value.
- `recover` binds the error track and may return a failed workflow back to success.
- `pipe(value, ...fns)` is the variadic value-first pipe (up to 9 steps); `flow(...fns)` is the variadic point-free composition in `@onrails/result/pipe`.
- Optional dot-chaining via `fluent(r)` / `fluentAsync(ra)` in `@onrails/result/fluent`.

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

Use `Railway` when named context removes nesting or positional tuple plumbing. Prefer `asyncAfter`, `fromResult`, or direct `flatMap` for one- or two-step flows.

`railway(input, ...steps)` is the functional companion for reusable workflow steps. Step factories: `parseWith(parser, onThrow).as(key)`, `fromSyncNamed`, `fromResultNamed`, `fromPromiseNamed`, `fromAsyncNamed`, `deriveNamed`, `requireNamed`, `parallelNamed`, `select`.

## Combining results

- `combine` / `combineTuple` — sync, first-Err wins.
- `sequenceTupleAsync` — async, sequential, first-Err in input order.
- `parallelTupleAsync` — async, concurrent (branches overlap), first-Err in input order.
- `ResultAsync.combine` — homogeneous async collection.

## Validation

`@onrails/result/validation` is a separate surface for accumulated independent failures (vs. railway short-circuit).

- `validateAll(results, join)` — combine errors via a join function.
- `validateAllArray(results)` — collect all errors into a readonly array.
- `validateTupleArray(results)` — same for heterogeneous tuple shapes.

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
| `@onrails/result/interop` | Promise/ResultAsync boundary helpers |
| `@onrails/result/mcp` | MCP / HTTP boundary helpers |
| `@onrails/result/pipe` | Variadic `flow` for point-free composition |
| `@onrails/result/railway` | Named workflow builder and reusable step factories |
| `@onrails/result/try-gen` | Sync generator-style `Result` sugar |
| `@onrails/result/validation` | Independent validation with accumulated failures |
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
