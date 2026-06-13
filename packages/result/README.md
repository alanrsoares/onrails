# @onrails/result

Tagged `Result` / `ResultAsync` for railway-oriented TypeScript. Pure tagged unions, neverthrow-shaped compat shim, FL-friendly.

## Install

```bash
bun add @onrails/result
```

## Quick start (value-first — best inference)

```ts
import {
  asyncAfter,
  err,
  flatMapResult,
  fromAsync,
  mapResult,
  match,
  ok,
  trySync,
} from "@onrails/result";

const parse = trySync(
  (raw: string) => JSON.parse(raw),
  (e) => ({ kind: "parse" as const, message: String(e) }),
);

const pipeline = flatMapResult(parse('{"v":1}'), (data) => ok(data.v));
```

Long chains: `fluent()` from `@onrails/result/fluent` or `flatMapResult` (not curried `flatMap`) for TS inference.

For worked examples of multi-step pipelines, parser builders, validator ladders, and parallel sub-workflows see [RECIPES.md](./RECIPES.md).

## When to use what

| Shape                              | Reach for                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| One or two sync steps              | `flatMapResult`, `mapResult`, `match`                                |
| One or two async steps             | `ResultAsync.flatMap`, `asyncAfter`                                  |
| Long sync chain, value-first        | `pipe(r, map(...), flatMap(...), ...)`                              |
| Long sync chain, dot-style preferred | `fluent(r)` from `@onrails/result/fluent`                          |
| Reusable composed function          | `flow(...)` from `@onrails/result/pipe`                             |
| Several named sync/async steps     | `Railway.*` (fluent) or `railway(...)` (functional, reusable steps)  |
| Linear sync with early-return feel | `tryGen` + `$` from `@onrails/result/try-gen`                        |
| Independent validations, accumulated failures | `validateAll` / `validateTuple` from `@onrails/result/validation` |
| Sync → async lift, keep error type | `fromResult`, `asyncAfter` (do **not** use `fromAsync` here)         |
| `Promise<Result<…>>` boundary lift | `fromAsync` / `tryAsync`                                             |

Rule of thumb: pick the smallest tool that removes nesting. Reach for `Railway` only when named context replaces positional tuple plumbing.

## Sync → async boundaries

Use `fromResult` when a sync `Result` needs to enter a `ResultAsync` pipeline without widening the error channel:

```ts
import { fromResult, ok, type Result } from "@onrails/result";

const parsed: Result<number, "parse"> = ok(1);
const asyncParsed = fromResult(parsed);
// ResultAsync<number, "parse"> — no UnexpectedError widening
```

Use `asyncAfter` for the common "validate synchronously, then run async IO" shape:

```ts
import { asyncAfter, tryAsync, trySync } from "@onrails/result";

return asyncAfter(
  trySync(() => ArtifactSchema.parse(artifact), toError)(),
  (validated) =>
    tryAsync(
      getDb()
        .insert(artifacts)
        .values(validated)
        .then(() => undefined),
    ),
);
```

Use `tryAsync` for Promise boundaries with default `Error` normalization, or pass a custom rejection mapper:

```ts
const body = tryAsync(fetch(url).then((res) => res.text()));

const status = tryAsync(fetch(url), (error) => ({
  kind: "network" as const,
  message: String(error),
}));
```

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


## Awaitable `ResultAsync`

`ResultAsync` is thenable — `await ra` resolves to a bare tagged-union `Result<T, E>`. Narrow with `isOk(r)` / `isErr(r)` (type predicates) to read `.value` / `.error`.

```ts
const r = await getItemAsync();
if (isOk(r)) console.log(r.value.id);
else console.error(r.error);
```

## Match and unwrap helpers

`match` is the canonical positional fold. If a file imports `match` from `@onrails/pattern` or `ts-pattern`, resolve the collision by using namespace imports:

```ts
import * as R from "@onrails/result";
import { match } from "ts-pattern";

R.match(result, onOk, onErr);
```

> [!NOTE]
> `matchResult` is deprecated and will be removed in the next major version.

`unwrapOk` and `unwrapErr` are test/assertion helpers. Prefer `match`, `isOk`, or `isErr` in production control flow.

```ts
import { unwrapOk } from "@onrails/result";

expect(unwrapOk(parseConfig(raw))).toEqual(expected);
```


## `tryGen` — sync `?`

For short linear sync code:

```ts
import { $, ok, tryGen } from "@onrails/result";

const out = tryGen(() => {
  const a = $(parseA());
  const b = $(parseB());
  return ok(a + b);
});
```

Use `ResultAsync.combineTuple` (or `parallelTupleAsync` when branches should overlap) when combining heterogeneous async results and destructuring the result:

```ts
import { ResultAsync } from "@onrails/result";

const combined = ResultAsync.combineTuple([
  loadSettings(),
  loadModelCatalog(),
] as const);

const dto = combined.map(([settings, catalog]) =>
  buildDto(settings, catalog),
);
```

When TS only infers the first error in a generator-style flow, use `declareErrors<E1 | E2>()` from `/extra`.

## `Railway` — named service workflows

Use `Railway` from `@onrails/result/railway` when a service workflow has several named sync/async steps and would otherwise need manual context-carrying objects:

```ts
import { Railway } from "@onrails/result/railway";

const summary = Railway.fromSync("profileId", () => ProfileIdSchema.parse(id), toError)
  .fromPromise("row", ({ profileId }) => loadProfileRow(profileId), toError)
  .require("profile", "row", ({ profileId }) => new Error(`Profile not found: ${profileId}`))
  .derive("normalized", ({ profile }) => normalizeProfile(profile))
  .fromResult("stats", ({ normalized }) => enrichProfileStats(normalized))
  .parallel({
    recentArtifacts: ({ normalized }) => loadRecentArtifacts(normalized.id),
    jobMetrics: ({ normalized }) => loadJobMetrics(normalized.id),
  })
  .select(({ normalized, stats, recentArtifacts, jobMetrics }) =>
    toProfileSummary({ normalized, stats, recentArtifacts, jobMetrics }),
  );
```

Sync-only workflows return `Result<T, E>`. The first `fromPromise`, `fromAsync`, or `parallel` step upgrades the output to `ResultAsync<T, E>`.

Use lower-level helpers (`asyncAfter`, `fromResult`, `flatMapResult`) for one or two steps where a builder would add ceremony.

## `railway(...)` — reusable workflow steps

Use lowercase `railway(...)` when the steps should be named once and reused across workflows:

```ts
import {
  deriveNamed,
  fromPromiseNamed,
  parallelNamed,
  parseWith,
  railway,
  requireNamed,
  select,
} from "@onrails/result/railway";

const parseProfileId = parseWith(ProfileIdSchema, toError).as("profileId");

const loadProfileRow = fromPromiseNamed(
  "row",
  ({ profileId }) => loadProfileRowById(profileId),
  toError,
);

const requireProfile = requireNamed("profile", "row", ({ profileId }) =>
  new Error(`Profile not found: ${profileId}`),
);

const loadSummaryInputs = parallelNamed({
  recentArtifacts: ({ profile }) => loadRecentArtifacts(profile.id),
  jobMetrics: ({ profile }) => loadJobMetrics(profile.id),
});

const summary = railway(
  id,
  parseProfileId,
  loadProfileRow,
  requireProfile,
  deriveNamed("normalized", ({ profile }) => normalizeProfile(profile)),
  loadSummaryInputs,
  select(({ normalized, recentArtifacts, jobMetrics }) =>
    toProfileSummary({ normalized, recentArtifacts, jobMetrics }),
  ),
);
```

`railway(input, ...steps)` starts from `{ input }`. `parseWith(...).as(key)` is the usual first step for raw input. The final output is still mode-aware: sync-only steps return `Result`, while async steps return `ResultAsync`.

## Pipe

```ts
import { pipe } from "@onrails/result";
import { flow } from "@onrails/result/pipe";

// Value-first variadic pipe — threads a starting value through unary steps.
const name = pipe(
  parseConfig(raw),
  map((cfg) => cfg.user),
  flatMap((u) => (u.name ? ok(u.name) : err({ kind: "missing" }))),
  recover((e) => (e.kind === "missing" ? ok("anon") : err(e))),
  tap((n) => log(n)),
);

// Variadic point-free composition — define a reusable pipeline.
const parseUserName = flow(
  (raw: string) => parseConfig(raw),
  map((cfg) => cfg.user),
  flatMap((u) => (u.name ? ok(u.name) : err({ kind: "missing" }))),
);
parseUserName(raw);
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
| `@onrails/result/interop` | `fromAsync`, `fromResult`, `asyncAfter` |
| `@onrails/result/pipe` | `flow` (variadic point-free composition) |
| `@onrails/result/railway` | `Railway`, `railway`, named workflow helpers |
| `@onrails/result/try-gen` | `tryGen`, `yieldResult`, `$` |
| `@onrails/result/compat/neverthrow` | Migration shim |

See [DESIGN.md](./DESIGN.md).
