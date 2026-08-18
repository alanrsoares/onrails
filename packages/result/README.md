# @onrails/result

Tagged `Result` / `ResultAsync` for railway-oriented TypeScript. Pure tagged unions, neverthrow-shaped compat shim, FL-friendly.

## Install

```bash
bun add @onrails/result
```

## Quick start (value-first — best inference)

```ts
import { err, flatMap, fromThrowable, match, ok, trySync } from "@onrails/result";

// Run it now — the sync mirror of `tryAsync`.
const parsed = trySync(() => JSON.parse(raw));           // Result<unknown, Error>

// Or lift the throwing function once and reuse it.
const parse = fromThrowable(
  (raw: string) => JSON.parse(raw),
  (e) => ({ kind: "parse" as const, message: String(e) }),
);

const pipeline = flatMap(parse('{"v":1}'), (data) => ok(data.v));
```

Every transform is dual-form: data-first `flatMap(r, fn)` (best inference) or curried `flatMap(fn)(r)` for `pipe`/`flow`. Long chains: `fluent()` from `@onrails/result/fluent`.

For worked examples of multi-step pipelines, parser builders, validator ladders, and parallel sub-workflows see [RECIPES.md](./RECIPES.md).

## When to use what

| Shape                              | Reach for                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| One or two sync steps              | `flatMap`, `map`, `match`                                            |
| One or two async steps             | `ResultAsync.flatMap`, `asyncAfter`                                  |
| Long async chain, value-first      | `pipe(ra, RA.map(...), RA.flatMap(...))` from `@onrails/result/async` |
| Long sync chain, value-first        | `pipe(r, map(...), flatMap(...), ...)`                              |
| Long sync chain, dot-style preferred | `fluent(r)` from `@onrails/result/fluent`                          |
| Reusable composed function          | `flow(...)` from `@onrails/result/pipe`                             |
| Several named sync/async steps     | `Railway.*` builder from `@onrails/result/railway`                   |
| Linear sync with early-return feel | `tryGen` + `$` from `@onrails/result/try-gen`                        |
| Independent validations, accumulated failures | `validateAll` / `validateTuple` from `@onrails/result` |
| Sync → async lift, keep error type | `fromResult`, `asyncAfter` (do **not** use `fromAsync` here)         |
| `Promise<Result<…>>` boundary lift | `fromAsync` / `tryAsync`                                             |
| Throwing sync call, run it now     | `trySync(() => f())` — mirrors `tryAsync(promise)`                   |
| Throwing sync function, reusable   | `fromThrowable(f, onThrow)` — neverthrow's `Result.fromThrowable`    |

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
  trySync(() => ArtifactSchema.parse(artifact), toError),
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

For an object-form, self-labelling fold, use `matchTag` from [`@onrails/pattern`](../pattern/README.md) — it dispatches on `_tag` and requires one branch per tag, so the branches read as names instead of argument positions:

```ts
import { matchTag } from "@onrails/pattern";

const label = (r: Result<number, string>) =>
  matchTag(r, {
    Ok: (v) => `ok:${v.value}`,    // v: Ok<number>  — the member, not the payload
    Err: (e) => `err:${e.error}`,  // e: Err<string>
  });
```

Note the difference: `match` hands each branch the *payload*, `matchTag` hands it the narrowed *member*.

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

Use `ResultAsync.combineTuple` (or `ResultAsync.combineTupleParallel` when branches should overlap) when combining heterogeneous async results and destructuring the result:

```ts
import { ResultAsync } from "@onrails/result";

const combined = ResultAsync.combineTuple([
  loadSettings(),
  loadModelCatalog(),
]);

const dto = combined.map(([settings, catalog]) =>
  buildDto(settings, catalog),
);
```

When TS only infers the first error in a generator-style flow, use `declareErrors<E1 | E2>()` from `/extra`.

## Async pipelines — `@onrails/result/async`

`ResultAsync` is a class, so dot-chaining is always available and stays the shortest form for a one-off chain. When you want the sync side's *other* two syntaxes on the async carrier — value-first `pipe`, or point-free `flow` — import the data-last twins as a namespace:

```ts
import * as RA from "@onrails/result/async";
import { pipe } from "@onrails/result";
import { flow } from "@onrails/result/pipe";

// value-first
pipe(loadUser(id), RA.flatMap(loadOrders), RA.map((os) => os.length));
// ResultAsync<number, NotFound | DbError>

// reusable point-free pipeline — no value yet
const orderCount = flow(loadUser, RA.flatMap(loadOrders), RA.map((os) => os.length));
```

Every `ResultAsync` method has a twin here — `map`, `mapErr`, `bimap`, `flatMap`, `recover`, `tap`, `tapErr`, `match`, `unwrapOr` — each in both data-first and curried form. The terminals (`match`, `unwrapOr`) resolve to a plain `Promise`, ending the pipeline.

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

Step keys must be unique. Reusing one is a compile error naming the offending key — previously it overwrote at runtime while the type silently collapsed to `never`:

```ts
Railway.empty()
  .derive("x", () => 1)
  .derive("x", () => "two");   // ✗ key "x" already exists in the workflow context
```

Use lower-level helpers (`asyncAfter`, `fromResult`, `flatMap`) for one or two steps where a builder would add ceremony.

To share steps across workflows, extract plain functions of the context and plug them in via `.fromResult` / `.fromAsync`:

```ts
const loadProfileRow = ({ profileId }: { profileId: string }) =>
  tryAsync(loadProfileRowById(profileId), toError);

const summary = Railway.fromSync("profileId", () => ProfileIdSchema.parse(id), toError)
  .fromAsync("row", loadProfileRow)
  .require("profile", "row", ({ profileId }) => new Error(`Profile not found: ${profileId}`))
  .select(({ profile }) => toProfileSummary(profile));
```

## Pipe

`pipe` and `flow` both live in `@onrails/result/pipe`; `pipe` is also re-exported from the package root.

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

Both cap at **12 steps**. That cap is deliberate: a single recursive variadic signature would remove it, but it cannot give each step a contextual type from the previous step's output, so lambda parameters degrade to `unknown` (`map((cfg) => cfg.user)` stops inferring). Longer chains nest — `pipe(pipe(v, ...), ...)` — or factor a segment into a named `flow`.

## ESLint

`@onrails/eslint-plugin` — warns on `Promise<Result<…>>` and `_unsafeUnwrap*`.

## Breaking changes

### `trySync` is now eager; the lazy form is `fromThrowable`

`trySync` used to lift a throwing *function* and return a wrapper, while
`tryAsync` took a *value* and ran immediately — same prefix, opposite contract.
The two now agree, and the lifting form takes neverthrow's own name.

```ts
// before
const parse = trySync(JSON.parse, toErr);
parse(raw);
trySync(() => Schema.parse(input), toErr)();   // note the trailing ()

// after
const parse = fromThrowable(JSON.parse, toErr);
parse(raw);
trySync(() => Schema.parse(input), toErr);     // runs now, returns Result
trySync(() => Schema.parse(input));            // Result<T, Error> — onThrow optional
```

Mechanical migration: rename `trySync` → `fromThrowable` everywhere, then drop
the trailing `()` on any call site that immediately invoked the wrapper.

## Migration from neverthrow

See [@onrails/codemod](../codemod/README.md) for the automated codemod, and the **Compat surface** notes below.

### Compat surface

```ts
import { ResultAsync, Result, ok, err, okAsync, errAsync } from "@onrails/result/compat/neverthrow";
```

- `Result` / `ResultAsync` are class-shaped (`CompatResult` / `CompatResultAsync`).
- `await ra` resolves to a `CompatResult<T, E>` (thenable), so `.isOk()`, `.value`, `.error`, `.match()`, `.unwrapOr()` all work without an extra `.resolve()` call.
- `andThen` / `chain` / `flatMap` / `orElse` accept any of `CompatResultAsync` / `ResultAsync` / `CompatResult` / tagged `Result` returns and union the error type.
- Supported: `andThen`, `asyncAndThen`, `chain`, `flatMap`, `map`, `mapErr`, `orElse`, `match`, `unwrapOr`, `isOk`, `isErr`, `andTee`, `orTee`, `Result.combine`, `Result.fromThrowable`, `ResultAsync.combine`, `ResultAsync.fromPromise`, `ResultAsync.fromSafePromise`, `ResultAsync.fromThrowable`, `_unsafeUnwrap` / `_unsafeUnwrapErr`.
- Treat the compat surface as a migration step, not the destination — once a package migrates, switch its imports to `@onrails/result` and `@onrails/result/fluent`.

## Subpaths

| Path | Contents |
|------|----------|
| `@onrails/result` | Core + interop exports |
| `@onrails/result/async` | Data-last twins of the `ResultAsync` methods (for `pipe` / `flow`) |
| `@onrails/result/fluent` | `fluent()` |
| `@onrails/result/extra` | Error-type utilities |
| `@onrails/result/pipe` | `pipe` (value-first) and `flow` (point-free), up to 12 steps |
| `@onrails/result/railway` | `Railway` named-context workflow builder |
| `@onrails/result/try-gen` | `tryGen`, `yieldResult`, `$` |
| `@onrails/result/compat/neverthrow` | Migration shim |

See [DESIGN.md](./DESIGN.md).
