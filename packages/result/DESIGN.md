# @onrails/result — design

Experimental typed `Result` / `ResultAsync` for Alanstack repos. See grill session decisions in repo root.

## Goals

- **B + D**: strong TypeScript inference; Alanstack error-style canon
- **Smaller / purer runtime**: tagged union, `sideEffects: false`, tree-shakeable subpaths
- **Pragmatic Fantasy Land**: `map`, `chain`/`flatMap`, `bimap` on sync + async
- **Phased migration**: `@onrails/result/compat/neverthrow` mirrors neverthrow names

## Runtime model

```ts
type Result<T, E> =
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E };
```

- Default API: module functions (`map`, `flatMap`, `match`, …)
- Optional chaining: `fluent(r)` / `fluentAsync(ra)` from `@onrails/result/fluent`
- `flatMap` canonical; `andThen` and `chain` are aliases
- `fromResult` lifts an already-known sync `Result` into `ResultAsync` without `UnexpectedError` widening
- `asyncAfter` is the canonical sync-validation → async-IO bridge
- `tryAsync` wraps Promise boundaries with default `Error` normalization
- `combineTupleAsync` preserves tuple positions for heterogeneous async combines
- `Railway` from `@onrails/result/railway` handles larger named workflows and tracks whether the final output is sync or async

## Sync / async interop

There are two distinct lift paths:

- `fromResult(result)` is for an already-known sync `Result<T, E>`. It cannot defect, so it returns `ResultAsync<T, E>`.
- `fromAsync(fn)` and `ResultAsync.fromResultPromise(promise)` are for `Promise<Result<T, E>>`. The promise can reject outside the `Result` channel, so the error type widens with `UnexpectedError` unless a custom defect mapper is supplied.

Use `asyncAfter(result, fn)` when a sync validation step needs to bind into async IO:

```ts
asyncAfter(
  trySync(() => Schema.parse(input), toError)(),
  (value) => tryAsync(save(value)),
);
```

This is intentionally small; larger ETL workflows can use the `Railway.*` workflow layer.

## Railway workflows

`Railway<C, E, M>` is a named-context workflow builder for service-layer ETL.

- `Railway.fromSync`, `.fromResult`, and `.derive` preserve sync mode.
- `.fromPromise`, `.fromAsync`, and `.parallel` upgrade the workflow to async mode.
- `.require(key, source, onMissing)` converts a nullable context field into a required non-null field.
- `.parallel(record)` runs independent `ResultAsync` branches and merges named outputs back into context.
- `.select(fn)` projects the final context.
- `.done()` returns the accumulated context.

The return type is mode-aware:

```ts
type RailwayOutput<T, E, M extends RailwayMode> =
  M extends "async" ? ResultAsync<T, E> : Result<T, E>;
```

Use `Railway` when named context removes real nesting or positional tuple plumbing. Prefer `asyncAfter`, `fromResult`, or direct `flatMapResult` for small one- or two-step flows.

`railway(input, ...steps)` is the functional companion for reusable workflow steps. It starts from `Railway.context({ input })` and applies step functions created by:

- `parseWith(parser, onThrow).as(key)`
- `fromSyncNamed(key, fn, onThrow)`
- `fromResultNamed(key, fn)`
- `fromPromiseNamed(key, fn, onReject)`
- `fromAsyncNamed(key, fn)`
- `deriveNamed(key, fn)`
- `requireNamed(key, source, onMissing)`
- `parallelNamed(record)`
- `select(fn)`

Both APIs share the same `Railway` runtime. The functional surface is for reusable step values; the fluent surface is for one-off service workflows.

## Combining results

- `combine(results)` collects homogeneous sync results into `Result<T[], E>`.
- `combineTuple(results)` preserves heterogeneous sync tuple positions.
- `ResultAsync.combine(results)` collects homogeneous async results into `ResultAsync<T[], E>`.
- `combineTupleAsync(results)` preserves heterogeneous async tuple positions.

`combineTupleAsync` preserves input order and returns the first `Err` in input order.

## Errors

- `E` is fully generic on the core package
- `@onrails/result/extra`: `errOf`, `unionErrors`, `mapErrKind` helpers for discriminated unions

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/result` | Core |
| `@onrails/result/fluent` | Dot-style chains |
| `@onrails/result/extra` | Error-type utilities |
| `@onrails/result/interop` | Promise/ResultAsync boundary helpers |
| `@onrails/result/railway` | Named workflow builder and reusable workflow steps |
| `@onrails/result/compat/neverthrow` | Migration shim (temporary) |

## Type tests

`test/types.spec.ts` — `ts-expect` (`expectType` + `TypeEqual`), same pattern as styled-cva.

## v1.0 gate

- bun tests: core ops, FL functor/monad laws (sync), neverthrow-compat fixtures
- README with Alanstack error guidance
- **Not** in v1.0: npm publish, printr-mcp/yappr migrations

## Implemented (P0–P3)

- **P0** `fromAsync` / `InferOk` / `InferErr` — `@onrails/result/interop`
- **P0** `fromResult` / `asyncAfter` — sync-to-async boundary helpers
- **P0** `matchResult` — collision-free `match` alias
- **P0** `combineTupleAsync` — tuple-preserving async combine
- **P0** Tagged `{ kind }` errors documented in README
- **P1** `tryAsync` — Promise boundary with default `Error` normalization
- **P1** `unwrapOk` / `unwrapErr` — test/assert helpers
- **P1** MCP helpers — `@onrails/result/mcp`
- **P1** `flow` / `pipeResult` — `@onrails/result/pipe`
- **P2** `declareErrors`, `AccumulateErrors` — `@onrails/result/extra`
- **P2** `trySync` overload preservation
- **P3** `tryGen` / `yieldResult` / `$` — `@onrails/result/try-gen`
- **P3** `Railway` / `railway` / named workflow helpers — `@onrails/result/railway`
- **P3** `@onrails/eslint-plugin`

## Deferred

- npm publish visibility
- `ap` / `alt` / error `Semigroup`
