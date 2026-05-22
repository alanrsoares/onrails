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

## Errors

- `E` is fully generic on the core package
- `@onrails/result/extra`: `errOf`, `unionErrors`, `mapErrKind` helpers for discriminated unions

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/result` | Core |
| `@onrails/result/fluent` | Dot-style chains |
| `@onrails/result/extra` | Error-type utilities |
| `@onrails/result/compat/neverthrow` | Migration shim (temporary) |

## Type tests

`test/types.spec.ts` — `ts-expect` (`expectType` + `TypeEqual`), same pattern as styled-cva.

## v1.0 gate

- bun tests: core ops, FL functor/monad laws (sync), neverthrow-compat fixtures
- README with Alanstack error guidance
- **Not** in v1.0: npm publish, printr-mcp/yappr migrations

## Implemented (P0–P3)

- **P0** `fromAsync` / `InferOk` / `InferErr` — `@onrails/result/interop`
- **P0** Tagged `{ kind }` errors documented in README
- **P1** MCP helpers — `@onrails/result/mcp`
- **P1** `flow` / `pipeResult` — `@onrails/result/pipe`
- **P2** `declareErrors`, `AccumulateErrors` — `@onrails/result/extra`
- **P2** `trySync` overload preservation
- **P3** `tryGen` / `yieldResult` — `@onrails/result/try-gen`
- **P3** `@onrails/eslint-plugin`

## Deferred

- npm publish visibility
- `ap` / `alt` / error `Semigroup`
