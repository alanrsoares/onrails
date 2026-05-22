# RecallOS Feedback Change Plan for `@onrails/result`

This plan tracks the upstream `@onrails/result` changes motivated by the RecallOS native-result migration. It is intentionally scoped to the `onrails` repo and especially `packages/result`.

Source evidence:

- RecallOS migrated off `@onrails/result/compat/neverthrow` successfully.
- RecallOS now carries local helpers in `packages/core/result-async.ts`: `fromResult`, `asyncAfter`, `tryAsync`, `unwrapOk`, `unwrapErr`.
- RecallOS uses `packages/core/partial-pool.ts` for bounded partial-success work.
- RecallOS exposed friction around `ResultAsync.combine`, tuple typing, `match` naming collisions, and sync-chain readability.
- Follow-up design discussion identified a larger ergonomic opportunity: a named railway workflow layer with `Railway.*` fluent constructors and a lowercase `railway(...)` functional pipeline.
- The onrails packages have not been published. Treat this as a pre-publication design cleanup, not a public migration with backwards-compatibility obligations.

Non-goals:

- Do not reintroduce neverthrow-shaped APIs into the native surface.
- Do not make RecallOS-specific policy the default without tests and docs.
- Do not claim performance wins without a focused benchmark or call-site probe.
- Do not broaden the public API without matching runtime tests, type tests, and README/DESIGN notes.
- Do not ship the workflow layer until the low-level helpers it builds on are stable.

Pre-publication stance:

- Prefer clean final API shape over compatibility shims.
- Breaking internal imports are acceptable if RecallOS and onrails are updated together.
- No runtime deprecation warnings are needed for unpublished package consumers.
- Keep compat code only if it remains useful for local migrations or conformance tests.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked or needs decision

## Current Implementation Status

- [x] `fromResult`
- [x] `asyncAfter`
- [x] `matchResult`
- [x] `combineTupleAsync`
- [x] `unwrapOk` / `unwrapErr`
- [x] `tryAsync`
- [ ] `ResultAsync.combine` semantics decision
- [ ] partial-pool scope decision
- [ ] `Railway.*` fluent workflow design/implementation
- [ ] functional `railway(...)` pipeline design/implementation
- [ ] compat first-publication decision

## Track 0 — Baseline

Goal: establish the repo is healthy before changing exports.

- [ ] Run `bun check` from repo root.
- [ ] Record current `packages/result` public exports from `packages/result/src/index.ts`.
- [ ] Confirm `packages/result/test/types.spec.ts` is included in `packages/result/tsconfig.json`.
- [ ] Confirm existing untracked `.claude/` work is either intentionally ignored or committed separately from this plan.

Done criteria:

- `bun check` passes.
- No unrelated untracked work is modified by implementation PRs.

## Track 1 — P0 API: `fromResult`

Problem: RecallOS currently lifts sync `Result` into `ResultAsync` with a local cast because `ResultAsync.fromResultPromise(Promise.resolve(result))` widens the error channel with `UnexpectedError`. That widening is correct for real promises, but wrong for an already-known sync `Result`.

Target API:

```ts
export function fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E>;
```

Implementation tasks:

- [ ] Add `fromResult` in `packages/result/src/interop.ts`.
- [ ] Implement without `UnexpectedError` widening.
- [ ] Prefer a direct internal constructor path if available; otherwise use an audited implementation that cannot reject.
- [ ] Export from `packages/result/src/index.ts`.
- [ ] Decide whether to also export from `packages/result/src/interop.ts` subpath only, or both root and interop. Recommended: both.

Runtime tests:

- [ ] `fromResult(ok(1))` resolves to `Ok(1)`.
- [ ] `fromResult(err("x"))` resolves to `Err("x")`.
- [ ] `fromResult` does not wrap or transform the error value.

Type tests:

- [ ] `fromResult(ok(1))` is exactly `ResultAsync<number, never>`.
- [ ] `fromResult(err("x"))` is exactly `ResultAsync<never, string>`.
- [ ] `fromResult(ok(1) as Result<number, "domain">)` is exactly `ResultAsync<number, "domain">`, not `ResultAsync<number, "domain" | UnexpectedError>`.

Docs:

- [ ] Add a short README example: sync validation followed by async IO.
- [ ] Add a `DESIGN.md` note: `fromResultPromise` catches promise defects; `fromResult` is for already-known sync results and does not widen.

Done criteria:

- RecallOS can delete its local `fromResult` cast.
- `bun test packages/result` and `bun typecheck` pass.

## Track 2 — P0 API: `asyncAfter`

Problem: RecallOS repeats "validate synchronously, then run async IO" in storage repositories. The pattern is useful enough to standardize before publication.

Target API:

```ts
export function asyncAfter<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => ResultAsync<U, F>,
): ResultAsync<U, E | F>;
```

Implementation tasks:

- [ ] Add `asyncAfter` next to `fromResult` in `packages/result/src/interop.ts`.
- [ ] Implement as `fromResult(result).flatMap(fn)`.
- [ ] Export from root `packages/result/src/index.ts`.

Runtime tests:

- [ ] On `Ok`, calls `fn` and returns its result.
- [ ] On `Err`, does not call `fn`.
- [ ] Preserves the original `Err` value.
- [ ] Propagates async `Err` from `fn`.

Type tests:

- [ ] `asyncAfter(Result<T, E>, () => ResultAsync<U, F>)` returns `ResultAsync<U, E | F>`.
- [ ] Same-error cases do not widen unnecessarily beyond the expected union.

Docs:

- [ ] README "validate then persist" example.
- [ ] Mention as native replacement for local compat-era `.asyncAndThen` muscle memory.

Done criteria:

- RecallOS storage repositories can import `asyncAfter` from `@onrails/result`.

## Track 3 — P0 API: `matchResult`

Problem: `match` collides with `ts-pattern`'s `match` and with `String` / `RegExp` vocabulary. RecallOS uses ad hoc aliases like `matchResult` and `matchUnion`.

Target API:

```ts
export const matchResult: typeof match;
```

Implementation tasks:

- [ ] Add `matchResult = match` in `packages/result/src/result.ts`.
- [ ] Export from `packages/result/src/index.ts`.

Runtime tests:

- [ ] `matchResult(ok(value), onOk, onErr)` behaves exactly like `match`.
- [ ] `matchResult(err(error), onOk, onErr)` behaves exactly like `match`.

Type tests:

- [ ] `typeof matchResult` is exactly `typeof match`.

Docs:

- [ ] Add README note: when also importing `match` from `ts-pattern`, prefer `matchResult` from `@onrails/result`.

Done criteria:

- RecallOS can standardize imports without local aliasing.

## Track 4 — P0/P1 API: `combineTupleAsync`

Problem: sync `combineTuple` preserves tuple shape; `ResultAsync.combine` returns `T[]`. Heterogeneous async tuples force chaining, casts, or lost precision.

Target API:

```ts
export function combineTupleAsync<
  const R extends readonly ResultAsync<unknown, unknown>[],
>(
  results: R,
): ResultAsync<
  { [K in keyof R]: InferOk<R[K]> },
  { [K in keyof R]: InferErr<R[K]> }[number]
>;
```

Implementation tasks:

- [ ] Decide method vs function shape.
  - Option A: `ResultAsync.combineTuple(...)`
  - Option B: `combineTupleAsync(...)` exported function
  - Recommended: expose both only if root API already supports both static and function forms. Otherwise start with function export for tree-shakeable consistency with sync helpers.
- [ ] Implement tuple-preserving async combine in `packages/result/src/async.ts` or `interop.ts`.
- [ ] Reuse `InferOk` and `InferErr` types where possible.
- [ ] Preserve input order in the output tuple.
- [ ] Decide concurrency semantics explicitly:
  - Parallel resolution via `Promise.all`.
  - Or ordered resolution matching `ResultAsync.combine`.
  - Recommended: parallel, documented.

Runtime tests:

- [ ] Resolves `[okAsync(1), okAsync("a")]` to `Ok([1, "a"])`.
- [ ] Returns first error in input order after all settled, or returns the earliest resolved error. Pick one and document it.
- [ ] Preserves value order even when promises resolve out of order.

Type tests:

- [ ] Heterogeneous tuple returns `ResultAsync<readonly [number, string], never>`.
- [ ] Error types union across tuple positions.
- [ ] Accepts readonly `as const` arrays.

Docs:

- [ ] README example for fetching two independent resources with typed destructuring.
- [ ] DESIGN note comparing `combine`, `combineTuple`, and `combineTupleAsync`.

Done criteria:

- RecallOS can replace chained `.andThen` used only for tuple typing.

## Track 5 — P1 Decision: `ResultAsync.combine` Semantics

Problem: `ResultAsync.combine` currently awaits each `ResultAsync` in a loop. This is observable for lazy `ResultAsync` values, but not necessarily for already-started promises. RecallOS should not drive a blanket change without a precise semantic decision.

Decision questions:

- [ ] Is `ResultAsync` intended to be lazy, eager, or agnostic?
- [ ] Should `combine` preserve left-to-right effect ordering?
- [ ] Should `combine` prioritize wall-clock parallelism for independent work?
- [ ] What happens if multiple inputs fail: first input-order error or first completion-time error?

Probe tasks:

- [ ] Add a runtime test documenting current eager-promise behavior:

```ts
const slow = (id: number) =>
  ResultAsync.fromSafePromise(
    new Promise<number>((resolve) => setTimeout(() => resolve(id), 20)),
  );

// If the promises are already started, elapsed time should be near 20ms,
// even though combine awaits each ResultAsync in order.
```

- [ ] Add a runtime test for a deliberately lazy `ResultAsync` construction if the internals allow it.
- [ ] Decide whether current behavior is a feature or a footgun.

Possible outcomes:

- [ ] Leave `combine` as ordered and document it.
- [ ] Change `combine` to parallel resolution and treat input-order error selection as the stable result.
- [ ] Add `combineParallel` and keep `combine` ordered.

Recommended path:

- [ ] Do not change `combine` in the same PR as `combineTupleAsync`.
- [ ] First add documentation/tests that pin the current semantics.
- [ ] If changing behavior, do it in a dedicated `fix(result): ...` PR with a migration note.

Done criteria:

- `ResultAsync.combine` semantics are documented and tested.
- RecallOS can make an informed call about whether it needs a local `combineParallel`.

## Track 6 — P1 API: `unwrapOk` / `unwrapErr`

Problem: RecallOS tests need native replacements for neverthrow's unsafe unwrap helpers. RecallOS implemented local test/assert helpers.

Target API:

```ts
export function unwrapOk<T, E>(result: Result<T, E>): T;
export function unwrapErr<T, E>(result: Result<T, E>): E;
```

Implementation tasks:

- [ ] Add to `packages/result/src/result.ts`.
- [ ] Export from root `packages/result/src/index.ts`.
- [ ] Decide names only; avoid `_unsafeUnwrap` naming in native API.

Runtime tests:

- [ ] `unwrapOk(ok(1))` returns `1`.
- [ ] `unwrapOk(err(error))` throws the original error value.
- [ ] `unwrapErr(err("x"))` returns `"x"`.
- [ ] `unwrapErr(ok(1))` throws a clear `TypeError`.

Type tests:

- [ ] `unwrapOk(Result<T, E>)` returns `T`.
- [ ] `unwrapErr(Result<T, E>)` returns `E`.

Docs:

- [ ] README note: intended for tests and boundary assertions; production code should usually use `match`, `isOk`, or `isErr`.

Done criteria:

- RecallOS can delete local `unwrapOk` / `unwrapErr`.

## Track 7 — P1 API: `tryAsync`

Problem: RecallOS and future consumers repeatedly wrap promises with `fromPromise(promise, toError)`.

Target API:

```ts
export function tryAsync<T>(promise: PromiseLike<T>): ResultAsync<T, Error>;
export function tryAsync<T, E>(
  promise: PromiseLike<T>,
  onReject: (error: unknown) => E,
): ResultAsync<T, E>;
```

Implementation tasks:

- [ ] Add to `packages/result/src/async.ts` or `interop.ts`.
- [ ] Use default `toError` normalizer when `onReject` is omitted.
- [ ] Export from root `packages/result/src/index.ts`.

Runtime tests:

- [ ] Resolves fulfilled promise to `Ok`.
- [ ] Maps rejected `Error` to the same `Error`.
- [ ] Maps rejected non-Error value to `Error(String(value))`.
- [ ] Honors custom `onReject`.

Type tests:

- [ ] Without `onReject`, returns `ResultAsync<T, Error>`.
- [ ] With custom `onReject`, returns `ResultAsync<T, E>`.

Docs:

- [ ] README boundary example.
- [ ] Mention distinction from `fromSafePromise`, which assumes the promise cannot reject.

Done criteria:

- RecallOS can import `tryAsync` from `@onrails/result` or keep only a local re-export.

## Track 8 — P2 API: `tapResult` / `tapErrResult`

Problem: logging or metrics side effects inside sync result chains need a small identity helper.

Target API:

```ts
export function tapResult<T, E>(
  result: Result<T, E>,
  fn: (value: T) => void,
): Result<T, E>;

export function tapErrResult<T, E>(
  result: Result<T, E>,
  fn: (error: E) => void,
): Result<T, E>;
```

Implementation tasks:

- [ ] Add sync helpers to `packages/result/src/result.ts`.
- [ ] Decide whether async `.tap` / `.tapErr` methods belong in `ResultAsync`.
- [ ] Keep callback return type `void`.

Runtime tests:

- [ ] Success tap runs only on `Ok`.
- [ ] Error tap runs only on `Err`.
- [ ] Both helpers return the original result identity.

Type tests:

- [ ] Helpers preserve `Result<T, E>` exactly.

Docs:

- [ ] Add small logging example.
- [ ] Warn against using tap helpers for control flow.

Done criteria:

- Helpers exist only if there is a concrete downstream call site or clear demand.

## Track 9 — P2 Candidate: Partial Pool Utility

Problem: RecallOS extracted a generic bounded worker pool with partial-success collection. It may belong in onrails if the package wants concurrency utilities alongside `ResultAsync`.

Decision questions:

- [ ] Is a worker pool in scope for `@onrails/result`, or should it live in a separate package/subpath?
- [ ] Should the utility depend on `AbortSignal`?
- [ ] Should worker defects become per-item failures, or should the outer `ResultAsync` fail?
- [ ] Should the utility require `ResultAsync` steps only, or accept `Promise<Result>` via `fromAsync`?

If accepted:

- [ ] Add `packages/result/src/pool.ts`.
- [ ] Export under a subpath first, for example `@onrails/result/pool`.
- [ ] Do not put it in the root export until the API is proven.
- [ ] Add tests for empty input, concurrency clamp, per-item errors, abort behavior, and thrown defects.

Recommended path:

- [ ] Keep this as a recipe or subpath until at least one more real local use case exists beyond RecallOS.

Done criteria:

- Explicit decision recorded: `defer`, `recipe`, `subpath`, or `root export`.

## Track 10 — P2 Design: `Railway` Fluent Workflow API

Problem: low-level `Result` / `ResultAsync` primitives model failure well, but service-layer ETL code can become syntactically heavy when it mixes Zod validation, Drizzle queries, nullable row handling, sync transforms, and parallel async enrichment. RecallOS has examples where the domain flow is simple but the syntax exposes too much `fromResult`, `flatMapResult`, and async bridge plumbing.

Design goal:

- `Railway.*` is the fluent, app-workflow API.
- It accumulates a typed context object through named steps.
- It returns `Result<T, E>` when all steps are sync.
- It upgrades to `ResultAsync<T, E>` once any async boundary appears.

Example target syntax:

```ts
const summary = Railway
  .fromSync("profileId", () => ProfileIdSchema.parse(id), toError)
  .fromPromise(
    "row",
    ({ profileId }) =>
      db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        with: { artifacts: true, jobs: true },
      }),
    toError,
  )
  .require("profile", "row", ({ profileId }) =>
    new Error(`Profile not found: ${profileId}`),
  )
  .derive("normalized", ({ profile }) => normalizeProfile(profile))
  .parallel({
    recent: ({ profile }) => loadRecentArtifacts(profile.id),
    metrics: ({ profile }) => loadJobMetrics(profile.id),
  })
  .select(({ normalized, recent, metrics }) =>
    toProfileSummary({ normalized, recent, metrics }),
  );
```

Expected type:

```ts
ResultAsync<ProfileSummary, Error>
```

Sync-only example:

```ts
const parsed = Railway
  .fromSync("id", () => IdSchema.parse(raw), toError)
  .derive("slug", ({ id }) => makeSlug(id))
  .select(({ id, slug }) => ({ id, slug }));
```

Expected type:

```ts
Result<{ id: Id; slug: string }, Error>
```

Mode model:

```ts
type RailwayMode = "sync" | "async";

type RailwayOutput<T, E, M extends RailwayMode> =
  M extends "async" ? ResultAsync<T, E> : Result<T, E>;
```

Fluent API sketch:

```ts
class Railway<C, E, M extends RailwayMode> {
  static empty(): Railway<{}, never, "sync">;

  static context<C>(context: C): Railway<C, never, "sync">;

  static fromSync<K extends string, T, E>(
    key: K,
    fn: () => T,
    onThrow: (error: unknown) => E,
  ): Railway<Record<K, T>, E, "sync">;

  static fromResult<K extends string, T, E>(
    key: K,
    fn: () => Result<T, E>,
  ): Railway<Record<K, T>, E, "sync">;

  static fromPromise<K extends string, T, E>(
    key: K,
    fn: () => PromiseLike<T>,
    onReject: (error: unknown) => E,
  ): Railway<Record<K, T>, E, "async">;

  static fromAsync<K extends string, T, E>(
    key: K,
    fn: () => ResultAsync<T, E>,
  ): Railway<Record<K, T>, E, "async">;

  derive<K extends string, T>(
    key: K,
    fn: (ctx: C) => T,
  ): Railway<C & Record<K, T>, E, M>;

  fromResult<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => Result<T, F>,
  ): Railway<C & Record<K, T>, E | F, M>;

  fromPromise<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => PromiseLike<T>,
    onReject: (error: unknown) => F,
  ): Railway<C & Record<K, T>, E | F, "async">;

  fromAsync<K extends string, T, F>(
    key: K,
    fn: (ctx: C) => ResultAsync<T, F>,
  ): Railway<C & Record<K, T>, E | F, "async">;

  require<K extends string, S extends keyof C>(
    key: K,
    source: S,
    onMissing: (ctx: C) => E,
  ): Railway<C & Record<K, NonNullable<C[S]>>, E, M>;

  parallel<R extends Record<string, (ctx: C) => ResultAsync<unknown, unknown>>>(
    branches: R,
  ): Railway<C & UnwrapRailwayParallel<R>, E | RailwayParallelErr<R>, "async">;

  select<T>(fn: (ctx: C) => T): RailwayOutput<T, E, M>;

  done(): RailwayOutput<C, E, M>;
}
```

Runtime state sketch:

```ts
type RailwayState<C, E> =
  | { readonly mode: "sync"; readonly result: Result<C, E> }
  | { readonly mode: "async"; readonly result: ResultAsync<C, E> };
```

Step behavior:

- Sync mode + sync step stays sync.
- Sync mode + async step lifts the current `Result` into `ResultAsync`, then chains.
- Async mode + any step stays async.
- `parallel(...)` always upgrades to async.
- `select(...)` and `done()` return `Result` or `ResultAsync` based on mode.

Design tasks:

- [x] Decide package location:
  - [ ] root export from `@onrails/result`
  - [x] subpath export `@onrails/result/railway`
  - Recommended: subpath first, root later if proven.
- [x] Decide class name and function names:
  - [x] Fluent: `Railway.*`
  - [ ] Functional: lowercase `railway(...)` in Track 11
- [x] Decide whether `derive` may throw. Recommended: pure only; use `fromSync` for throwing transforms.
- [ ] Decide whether `require` accepts `Maybe<T>` in addition to nullable values.
- [ ] Decide duplicate-key behavior at the type level. Recommended: disallow duplicate keys if feasible; otherwise document "later key overwrites earlier key."
- [x] Decide how `parallel` selects errors when multiple branches fail.

Implementation tasks:

- [x] Add `packages/result/src/railway.ts`.
- [x] Add package export `./railway` in `packages/result/package.json`.
- [x] Add runtime tests in `packages/result/test/railway.spec.ts`.
- [x] Add type tests in `packages/result/test/types.spec.ts`.
- [x] Add docs in `packages/result/README.md` and `packages/result/DESIGN.md`.

Runtime tests:

- [x] Sync-only railway returns a sync `Result`.
- [x] Async step upgrades output to `ResultAsync`.
- [x] `fromSync` maps thrown values through `onThrow`.
- [x] `fromPromise` maps rejection through `onReject`.
- [x] `fromResult` short-circuits on `Err`.
- [x] `fromAsync` short-circuits on async `Err`.
- [x] `require` fails on `null` / `undefined`.
- [x] `derive` preserves prior context and adds a field.
- [x] `parallel` runs independent branches and merges outputs.
- [x] `select` maps final context.
- [x] `done` returns accumulated context.

Type tests:

- [x] Context type grows by named fields.
- [x] `select` on sync-only workflow returns `Result<T, E>`.
- [x] `select` after `fromPromise`, `fromAsync`, or `parallel` returns `ResultAsync<T, E>`.
- [x] Error type unions across steps.
- [x] `require` narrows `T | null | undefined` to `T`.
- [x] `parallel` adds every branch key with unwrapped success types.

Docs:

- [x] Position `Railway` as a service-layer ETL builder, not a replacement for low-level `Result` APIs.
- [x] Include a Drizzle + Zod + DTO example.
- [x] Explain mode tracking: sync workflows return `Result`; async workflows return `ResultAsync`.
- [x] Explain when to use low-level helpers instead.

Done criteria:

- A RecallOS-style service workflow can be expressed without manual `fromResult(...)` bridge calls.
- The output type accurately tracks sync vs async mode.
- Public docs make the fluent API's scope clear.

## Track 11 — P2 Design: Functional `railway(...)` Pipeline

Problem: fluent `Railway.*` is good for one-off app workflows, but reusable ETL steps need a functional syntax similar to `date-fns` / `pipe`.

Design goal:

- Lowercase `railway(input, ...steps)` is the functional API.
- It composes reusable railway steps.
- It uses the same underlying step model as fluent `Railway`.
- It also returns `Result` or `ResultAsync` depending on whether any step is async.

Example target syntax:

```ts
const parseProfileId = parseWith(ProfileIdSchema, toError).as("profileId");

const loadProfileRow = bindNamed("row", ({ profileId }) =>
  fromPromise(
    db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
    toError,
  ),
);

const requireProfile = requireNamed("profile", "row", ({ profileId }) =>
  new Error(`Profile not found: ${profileId}`),
);

const summary = railway(
  id,
  parseProfileId,
  loadProfileRow,
  requireProfile,
  deriveNamed("normalized", ({ profile }) => normalizeProfile(profile)),
  parallelNamed({
    recent: ({ profile }) => loadRecentArtifacts(profile.id),
    metrics: ({ profile }) => loadJobMetrics(profile.id),
  }),
  select(({ normalized, recent, metrics }) =>
    toProfileSummary({ normalized, recent, metrics }),
  ),
);
```

Initial step helper candidates:

- [x] `parseWith(schema, onThrow).as(key)`
- [x] `fromResultNamed(key, fn)`
- [x] `fromSyncNamed(key, fn, onThrow)`
- [x] `fromPromiseNamed(key, fn, onReject)`
- [x] `fromAsyncNamed(key, fn)`
- [x] `deriveNamed(key, fn)`
- [x] `requireNamed(key, source, onMissing)`
- [x] `parallelNamed(record)`
- [x] `select(fn)`

Design tasks:

- [x] Decide whether this belongs in the same `@onrails/result/railway` subpath as `Railway`.
- [x] Decide whether `railway(input, ...steps)` starts from raw input or requires `Railway.context(input)`.
- [x] Decide if step helpers should be data-first or data-last.
- [x] Decide whether `.as(key)` is worth the extra object wrapper for parse helpers.
- [x] Decide naming so functional helpers do not collide with low-level `fromResult`, `fromAsync`, `map`, and `flatMap`.

Implementation tasks:

- [x] Build after fluent `Railway` or extract a shared internal step model first.
- [x] Add type tests for reusable step inference.
- [x] Add docs comparing `Railway.*` and `railway(...)`.

Recommended sequencing:

- [x] Design both APIs together.
- [x] Implement fluent `Railway` first.
- [x] Implement functional `railway(...)` only after the fluent type model proves stable.

Done criteria:

- Reusable steps can be declared once and used in multiple workflows.
- The functional API does not duplicate runtime logic from fluent `Railway`.
- Docs clearly say: `Railway.*` for named one-off workflows, `railway(...)` for reusable step composition.

## Track 12 — Compat Lifecycle Before Publication

Problem: RecallOS is off `compat/neverthrow`, and onrails packages have not been published. There are no public consumers to deprecate for. The compat surface should either remain as local migration tooling or be removed before first publication.

Tasks:

- [ ] Decide whether `@onrails/result/compat/neverthrow` should ship at all in the first public release.
- [ ] If compat stays, document it as temporary migration tooling, not a recommended API.
- [ ] If compat goes, delete the subpath export before first publication and update tests accordingly.
- [ ] Do **not** add runtime `console.warn` for unpublished consumers.
- [ ] Keep neverthrow conformance tests only if they still protect compat behavior that will ship.

Done criteria:

- First-publication compat status is explicit: `ship temporary compat` or `remove before publish`.

## Track 13 — Docs And Examples

Tasks:

- [ ] Update `packages/result/README.md` with:
  - [x] `fromResult`
  - [x] `asyncAfter`
  - [x] `tryAsync`
  - [x] `matchResult`
  - [x] `combineTupleAsync`
  - [x] `unwrapOk` / `unwrapErr`
  - [x] `Railway.*` fluent workflow API if Track 10 ships
  - [x] `railway(...)` functional pipeline if Track 11 ships
- [ ] Update `packages/result/DESIGN.md` with:
  - [x] sync vs async composition
  - [x] error-widening rules
  - [x] combine semantics
  - [x] railway workflow mode tracking
  - [ ] compat first-publication decision
- [x] If keeping `.claude/skills/railway-do-notation/SKILL.md`, remove or reword any claim that `yieldResult as $` is the standard style unless the team explicitly chooses that convention.

Done criteria:

- Public docs match exported API.
- No doc examples use APIs not exported from root or documented subpaths.

## Track 14 — Verification Matrix

Run after each implementation PR:

- [x] `bun run --filter @onrails/result typecheck`
- [x] `bun run --filter @onrails/result test`
- [x] `bun check` before final merge

For API PRs:

- [ ] Runtime spec added under `packages/result/test/*.spec.ts`.
- [ ] Type assertion added to `packages/result/test/types.spec.ts`.
- [ ] Root export checked in `packages/result/src/index.ts`.
- [ ] README or DESIGN updated.

For behavior-changing PRs:

- [ ] Existing neverthrow compat tests still pass.
- [ ] Behavior change is called out in PR body.
- [ ] Pre-publication impact is identified: onrails-only, RecallOS backport required, or first-publication API change.

## Potential Refactor Examples

These examples are not implementation requirements. They are target-shape examples for evaluating whether `Railway.*` and `railway(...)` actually improve syntax in RecallOS-style code.

### Example A — Drizzle Query + Sync ETL + Parallel Enrichment

Current native-style code tends to expose bridge plumbing:

```ts
function loadProfileSummary(id: string): ResultAsync<ProfileSummary, Error> {
  return asyncAfter(
    // Synchronous validation boundary. If Zod throws, map to Error.
    trySync(() => ProfileIdSchema.parse(id), toError)(),
    (profileId) =>
      tryAsync(
        // Drizzle query. The promise rejection becomes Err(Error).
        db.query.profiles.findFirst({
          where: eq(profiles.id, profileId),
          with: { artifacts: true, jobs: true },
        }),
      ).flatMap((row) =>
        fromResult(
          // Nullable row becomes a railway error.
          flatMapResult(
            Maybe.toResult(
              Maybe.fromNullable(row),
              () => new Error(`Profile not found: ${profileId}`),
            ),
            (profile) =>
              // Sync normalization and stats derivation are nested because
              // each step needs values from the previous closure.
              flatMapResult(normalizeProfile(profile), (normalized) =>
                mapResult(enrichProfileStats(normalized), (stats) => ({
                  profile: normalized,
                  stats,
                })),
              ),
          ),
        ).flatMap(({ profile, stats }) =>
          // Independent async work, but tuple names are not visible here.
          ResultAsync.combine([
            loadRecentArtifacts(profile.id),
            loadJobMetrics(profile.id),
          ]).map(([recentArtifacts, jobMetrics]) =>
            toProfileSummary({
              profile,
              stats,
              recentArtifacts,
              jobMetrics,
            }),
          ),
        ),
      ),
  );
}
```

Target fluent `Railway.*` syntax:

```ts
function loadProfileSummary(id: string): ResultAsync<ProfileSummary, Error> {
  return Railway
    // Start sync. This step returns Result<{ profileId }, Error>.
    .fromSync("profileId", () => ProfileIdSchema.parse(id), toError)

    // First async boundary. The whole railway upgrades to ResultAsync.
    .fromPromise(
      "row",
      ({ profileId }) =>
        db.query.profiles.findFirst({
          where: eq(profiles.id, profileId),
          with: { artifacts: true, jobs: true },
        }),
      toError,
    )

    // Convert nullable Drizzle output into a required `profile` field.
    // On null/undefined, short-circuit with the provided error.
    .require("profile", "row", ({ profileId }) =>
      new Error(`Profile not found: ${profileId}`),
    )

    // Pure sync transform. This should not catch throws; use fromSync if a
    // transform can throw.
    .derive("normalized", ({ profile }) => normalizeProfile(profile))

    // Sync Result-returning ETL step. If stats derivation returns Err, the
    // railway short-circuits; otherwise `stats` is added to context.
    .fromResult("stats", ({ normalized }) => enrichProfileStats(normalized))

    // Independent async branches run from the same context and merge their
    // named outputs back into the context.
    .parallel({
      recentArtifacts: ({ normalized }) => loadRecentArtifacts(normalized.id),
      jobMetrics: ({ normalized }) => loadJobMetrics(normalized.id),
    })

    // Final projection. Because the railway crossed async earlier, select
    // returns ResultAsync<ProfileSummary, Error>.
    .select(({ normalized, stats, recentArtifacts, jobMetrics }) =>
      toProfileSummary({
        profile: normalized,
        stats,
        recentArtifacts,
        jobMetrics,
      }),
    );
}
```

What this should prove:

- [ ] No manual `fromResult(...)` bridge in app code.
- [ ] Named context replaces closure nesting.
- [ ] Nullable Drizzle rows have a first-class `.require(...)` path.
- [ ] Parallel work has named outputs instead of positional tuple destructuring.
- [ ] The return type is `ResultAsync` only because an async step appears.

### Example B — RecallOS Ingestion Sync Setup

Current shape from the RecallOS ingestion path, simplified:

```ts
return fromResult(
  // Combine two sync Results, preserving tuple type.
  combineTuple([embeddingModelResult, chunkerResult]),
).flatMap(([embeddingModel, chunker]) => {
  const artifactResult = trySync(
    // Zod parse can throw.
    () => ArtifactSchema.parse({ /* artifact fields */ }),
    toError,
  )();

  const bundleResult: Result<
    { artifact: Artifact; chunkData: Chunk[] },
    Error
  > = flatMapResult(artifactResult, (artifact) =>
    flatMapResult(
      // Chunking returns Result<string[], Error>.
      chunker.chunk(artifact.content),
      (chunkTexts) =>
        mapResult(
          trySync(
            // Each chunk parse can throw.
            () => chunkTexts.map((text, index) =>
              ChunkSchema.parse({ /* chunk fields */ }),
            ),
            toError,
          )(),
          // The final sync payload needs both artifact and chunks.
          (chunkData) => ({ artifact, chunkData }),
        ),
    ),
  );

  return fromResult(bundleResult).flatMap(({ artifact, chunkData }) =>
    artifactRepo.createWithChunks(artifact, chunkData),
  );
});
```

Target fluent syntax:

```ts
return Railway
  // Start from existing sync Results without leaving sync mode.
  .fromResult("embeddingModel", () => embeddingModelResult)
  .fromResult("chunker", () => chunkerResult)

  // Throwing Zod parse boundary.
  .fromSync("artifact", () => ArtifactSchema.parse({ /* artifact fields */ }), toError)

  // Sync Result-returning chunker step.
  .fromResult("chunkTexts", ({ chunker, artifact }) =>
    chunker.chunk(artifact.content),
  )

  // Throwing sync parse over all chunks.
  .fromSync(
    "chunkData",
    ({ artifact, chunkTexts }) =>
      chunkTexts.map((text, index) =>
        ChunkSchema.parse({ /* chunk fields */ }),
      ),
    toError,
  )

  // First async boundary. The railway upgrades here.
  .fromAsync("persisted", ({ artifact, chunkData }) =>
    artifactRepo.createWithChunks(artifact, chunkData),
  )

  // Final projection returns ResultAsync<IngestSetup, Error>.
  .select(({ embeddingModel, chunker, artifact, chunkData, persisted }) => ({
    embeddingModel,
    chunker,
    artifact,
    chunkData,
    persisted,
  }));
```

Alternative sync-only sub-workflow:

```ts
const setup = Railway
  .fromResult("embeddingModel", () => embeddingModelResult)
  .fromResult("chunker", () => chunkerResult)
  .fromSync("artifact", () => ArtifactSchema.parse({ /* ... */ }), toError)
  .fromResult("chunkTexts", ({ chunker, artifact }) =>
    chunker.chunk(artifact.content),
  )
  .fromSync(
    "chunkData",
    ({ artifact, chunkTexts }) => chunkTexts.map(/* parse chunks */),
    toError,
  )
  .done();

// Because every step above is sync, setup is Result<SetupContext, Error>.
return fromResult(setup).flatMap(({ artifact, chunkData }) =>
  artifactRepo.createWithChunks(artifact, chunkData),
);
```

What this should prove:

- [ ] Sync-only sections can remain `Result` until the first async boundary.
- [ ] The same API can represent either a sub-workflow (`done`) or a full async flow (`fromAsync` + `select`).
- [ ] `fromResult("name", fn)` replaces nested `flatMapResult`.

### Example C — Functional `railway(...)` With Reusable Steps

Functional syntax should be better when ETL pieces are reusable across services.

```ts
const parseProfileId =
  // Parse the raw input and name the output `profileId`.
  parseWith(ProfileIdSchema, toError).as("profileId");

const loadProfileRow = fromPromiseNamed(
  "row",
  // This reusable step depends on the context produced by parseProfileId.
  ({ profileId }) =>
    db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      with: { artifacts: true, jobs: true },
    }),
  toError,
);

const requireProfile = requireNamed(
  "profile",
  "row",
  // Error factories can read any accumulated context.
  ({ profileId }) => new Error(`Profile not found: ${profileId}`),
);

const normalize = deriveNamed("normalized", ({ profile }) =>
  normalizeProfile(profile),
);

const loadSummaryInputs = parallelNamed({
  recentArtifacts: ({ normalized }) => loadRecentArtifacts(normalized.id),
  jobMetrics: ({ normalized }) => loadJobMetrics(normalized.id),
});

const toSummary = select(
  ({ normalized, recentArtifacts, jobMetrics }) =>
    toProfileSummary({
      profile: normalized,
      recentArtifacts,
      jobMetrics,
    }),
);

const summary = railway(
  id,
  parseProfileId,
  loadProfileRow,
  requireProfile,
  normalize,
  loadSummaryInputs,
  toSummary,
);
```

What this should prove:

- [ ] Steps are reusable values.
- [ ] The functional API shares the same context accumulation model as fluent `Railway`.
- [ ] `railway(...)` remains readable without method chaining.
- [ ] The output type still tracks sync vs async mode across the step list.

### Example D — Boundary Helper Replacement

If `fromResult`, `asyncAfter`, and `tryAsync` land before the full `Railway` API, RecallOS can still improve syntax incrementally.

Current local-helper style:

```ts
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

Target upstream-helper style:

```ts
return asyncAfter(
  // `trySync` keeps the Zod parse as a sync Result boundary.
  trySync(() => ArtifactSchema.parse(artifact), toError)(),

  // `tryAsync` is the promise boundary with default Error normalization.
  (validated) =>
    tryAsync(
      getDb()
        .insert(artifacts)
        .values(validated)
        .then(() => undefined),
    ),
);
```

Target `Railway` style, if the workflow API ships:

```ts
return Railway
  // Validate and name the artifact.
  .fromSync("artifact", () => ArtifactSchema.parse(artifact), toError)

  // Persist it. This is the first async step, so output becomes ResultAsync.
  .fromPromise(
    "inserted",
    ({ artifact }) =>
      getDb()
        .insert(artifacts)
        .values(artifact)
        .then(() => undefined),
    toError,
  )

  // Hide the internal context from callers.
  .select(() => undefined);
```

What this should prove:

- [ ] Low-level helper work is still valuable even if `Railway` is deferred.
- [ ] `Railway` should not replace every small repository method if `asyncAfter` is already clear.

## Suggested PR Sequence

Keep PRs small. Recommended order:

1. [ ] `feat(result): add fromResult and asyncAfter`
   - Tracks 1 and 2.
   - Highest value for RecallOS.
2. [ ] `feat(result): add matchResult alias`
   - Track 3.
   - Tiny, low risk.
3. [ ] `feat(result): add tuple async combine`
   - Track 4.
   - Keep separate because types are subtle.
4. [ ] `test(result): pin ResultAsync combine semantics`
   - Track 5.
   - No behavior change unless the decision is explicit.
5. [ ] `feat(result): add unwrap helpers`
   - Track 6.
6. [ ] `feat(result): add tryAsync`
   - Track 7.
7. [ ] `docs(result): document native migration helpers`
   - Track 13, if docs were not bundled with each feature.
8. [ ] `docs(result): decide compat first-publication lifecycle`
   - Track 12.
9. [ ] Optional: `feat(result): add tap helpers`
   - Track 8, only with a concrete use case.
10. [ ] Optional: pool utility proposal
   - Track 9, probably subpath or recipe first.
11. [ ] Design PR: `docs(result): design railway workflow api`
   - Tracks 10 and 11.
   - No implementation until the design is reviewed.
12. [ ] Optional: `feat(result): add Railway workflow`
   - Track 10 first; Track 11 later.

## Sync Checklist For RecallOS

After onrails changes land or RecallOS updates its file dependency:

- [ ] Replace RecallOS local `fromResult` with upstream export.
- [ ] Replace RecallOS local `asyncAfter` with upstream export.
- [ ] Replace RecallOS local `unwrapOk` / `unwrapErr` with upstream export.
- [ ] Decide whether RecallOS still needs local `tryAsync` / `toError`.
- [ ] Replace ad hoc `match as matchResult` imports with upstream `matchResult`.
- [ ] Use `combineTupleAsync` where async tuple typing is the only reason for chained `.andThen`.
- [ ] Keep `partial-pool` local unless Track 9 lands.
- [ ] Prototype a RecallOS ingestion or dashboard server workflow with `Railway.*` once Track 10 lands.
- [ ] Prototype reusable RecallOS ETL steps with `railway(...)` once Track 11 lands.

## Open Decisions

- [ ] Should `combineTupleAsync` be static, function-style, or both?
- [ ] Should `ResultAsync.combine` remain ordered or become parallel?
- [ ] Should `tryAsync` live in `async.ts` or `interop.ts`?
- [ ] Should partial-pool utilities be in scope for `@onrails/result`?
- [ ] Should `compat/neverthrow` ship in the first public release at all?
- [ ] Should `.claude/skills/railway-do-notation/SKILL.md` be tracked in this repo, and if so should it avoid `$` as a recommended alias?
- [ ] Should `Railway` ship from root or a `./railway` subpath first?
- [ ] Should `derive` be pure only, with throwing transforms forced through `fromSync`?
- [ ] Should `Railway.require` support `Maybe<T>` as well as nullable values?
- [ ] Should duplicate workflow keys be a type error?
- [ ] Should `railway(input, ...steps)` start with raw input or named context?
