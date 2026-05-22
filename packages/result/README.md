# @onrails/result

Tagged `Result` / `ResultAsync` for railway-oriented TypeScript. Pure tagged unions, neverthrow-shaped compat shim, FL-friendly.

## Install (local — pre-publish)

```bash
bun add @onrails/result@file:../onrails/packages/result
```

## Quick start (value-first — best inference)

```ts
import { err, flatMapResult, fromAsync, mapResult, match, ok, trySync } from "@onrails/result";

const parse = trySync(
  (raw: string) => JSON.parse(raw),
  (e) => ({ kind: "parse" as const, message: String(e) }),
);

const pipeline = flatMapResult(parse('{"v":1}'), (data) => ok(data.v));
```

Long chains: `fluent()` from `@onrails/result/fluent` or `flatMapResult` (not curried `flatMap`) for TS inference.

## Tagged error style

Prefer **tagged objects**, not bare `extends Error` classes — TS collapses structurally identical errors ([#652](https://github.com/supermacro/neverthrow/issues/652)).

```ts
type BotError =
  | { kind: "not_found"; id: string }
  | { kind: "network"; message: string };
```

Helpers: `@onrails/result/extra` — `hasKind`, `mapErrKind`, `declareErrors`, `UnionErrors`, `AccumulateErrors`.

## Async interop — `fromAsync`

Lift `async` handlers that return `Result` without leaking `Promise<Result<…>>`:

```ts
import { fromAsync, ok, err } from "@onrails/result";

async function getItem(): Promise<Result<{ id: string }, HttpError>> {
  if (!user) return err({ kind: "unauthorized" });
  return ok({ id: "x" });
}

// Public API: ResultAsync only
export const getItemAsync = fromAsync(getItem);
```

Aliases: `fromPromiseResult`, `makeResultAsync`, `resultAsyncFn` (neverthrow [#514](https://github.com/supermacro/neverthrow/issues/514) / [#608](https://github.com/supermacro/neverthrow/issues/608)).

## Awaitable `ResultAsync`

`ResultAsync` is thenable — `await ra` resolves to a bare tagged-union `Result<T, E>`. Narrow with `isOk(r)` / `isErr(r)` (type predicates) to read `.value` / `.error`.

```ts
const r = await getItemAsync();
if (isOk(r)) console.log(r.value.id);
else console.error(r.error);
```

## MCP / HTTP boundaries

```ts
import { toToolResponseAsync, unwrapFetchResultAsync } from "@onrails/result/mcp";

const ra = unwrapFetchResultAsync(
  client.GET("/tokens/{id}"),
  ({ error, response }) => new PrintrApiError(response.status, detail),
);
return toToolResponseAsync(ra);
```

## `tryGen` — sync `?`

Prefer `flatMap` / `fluent` for long pipelines. For short linear sync code:

```ts
import { ok, tryGen, yieldResult } from "@onrails/result/try-gen";

const out = tryGen(() => {
  const a = yieldResult(parseA());
  const b = yieldResult(parseB());
  return ok(a + b);
});
```

When TS only infers the first error in a generator-style flow, use `declareErrors<E1 | E2>()` from `/extra`.

## Pipe

```ts
import { flow, pipeResult } from "@onrails/result/pipe";
```

## ESLint

`@onrails/eslint-plugin` — warns on `Promise<Result<…>>` and `_unsafeUnwrap*`.

## Migration from neverthrow

See [@onrails/codemod](../codemod/README.md) for the automated codemod, and the **Compat surface** notes below.

### Compat surface

```ts
import { ResultAsync, Result, ok, err, okAsync, errAsync } from "@onrails/result/compat/neverthrow";
```

- `Result` / `ResultAsync` are class-shaped (`CompatResult` / `CompatResultAsync`).
- `await ra` resolves to a `CompatResult<T, E>` (thenable), so `.isOk()`, `.value`, `.error`, `.match()`, `.unwrapOr()` all work without an extra `.resolve()` call.
- `andThen` / `chain` / `flatMap` / `orElse` accept any of `CompatResultAsync` / `ResultAsync` / `CompatResult` / tagged `Result` returns and union the error type.
- Supported: `andThen`, `asyncAndThen`, `chain`, `flatMap`, `flatMapResult`, `andThenResult`, `map`, `mapErr`, `orElse`, `match`, `unwrapOr`, `isOk`, `isErr`, `andTee`, `orTee`, `Result.combine`, `Result.fromThrowable`, `ResultAsync.combine`, `ResultAsync.fromPromise`, `ResultAsync.fromSafePromise`, `ResultAsync.fromThrowable`, `_unsafeUnwrap` / `_unsafeUnwrapErr`.
- Treat the compat surface as a migration step, not the destination — once a package migrates, switch its imports to `@onrails/result` and `@onrails/result/fluent`.

## Subpaths

| Path | Contents |
|------|----------|
| `@onrails/result` | Core + interop exports |
| `@onrails/result/fluent` | `fluent()`, `fluentAsync()` |
| `@onrails/result/extra` | Error-type utilities |
| `@onrails/result/interop` | `fromAsync` only |
| `@onrails/result/mcp` | MCP / openapi-fetch helpers |
| `@onrails/result/pipe` | `flow`, `pipeResult` |
| `@onrails/result/try-gen` | `tryGen`, `yieldResult` |
| `@onrails/result/compat/neverthrow` | Migration shim |

See [DESIGN.md](./DESIGN.md).
