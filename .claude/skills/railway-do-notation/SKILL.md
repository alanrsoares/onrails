---
name: railway-do-notation
description: Ergonomic railway composition for `@onrails/result`: when to use low-level Result/ResultAsync helpers, fluent `Railway.*` workflows, functional `railway(...)` reusable steps, or sync `tryGen`. Use when writing or refactoring Result-heavy TypeScript, Drizzle/Zod ETL workflows, nested `flatMapResult` chains, mixed sync/async railway code, or when a user asks about "Railway", "railway", "do-notation", "safe workflow", or "expressive Result code". Do NOT use workflow builders for tiny repository methods where `asyncAfter` or `.flatMap` is clearer.
---

# Railway ergonomics in `@onrails/result`

This skill documents the intended ergonomic layers for `@onrails/result`.

The goal is expressive safe code without exposing plumbing at every composition site. Low-level `Result` and `ResultAsync` remain the foundation. Higher-level workflow syntax exists only where it makes complex service code easier to read.

## Decision Tree

Use the smallest layer that makes the code clear:

1. **Low-level helpers** for small functions and library internals.
   - Use `trySync`, `tryAsync`, `fromResult`, `asyncAfter`, `flatMapResult`, `.flatMap`, `.andThen`.
   - Best for one or two steps, repository helpers, and package internals.

2. **Fluent `Railway.*`** for one-off service workflows.
   - Use when code is ETL-shaped: validate input, query Drizzle, require nullable rows, derive values, run parallel enrichment, return DTO.
   - Best when there are 4+ named steps or mixed sync/async boundaries.

3. **Functional `railway(...)`** for reusable step composition.
   - Use when steps are shared across multiple workflows.
   - Best for date-fns-style reusable transforms.

4. **Sync `tryGen`** for dense synchronous `Result` chains only.
   - Use sparingly when no workflow builder is warranted and nested sync `flatMapResult` is hard to read.
   - Never use for `ResultAsync` or anything with `await`.

## Layer 1 — Low-Level Helpers

Use low-level helpers when the operation is small and direct.

```ts
return asyncAfter(
  // Sync validation boundary. If Zod throws, map the thrown value to Error.
  trySync(() => ArtifactSchema.parse(artifact), toError)(),

  // Async IO boundary. Promise rejection becomes Err(Error).
  (validated) =>
    tryAsync(
      getDb()
        .insert(artifacts)
        .values(validated)
        .then(() => undefined),
    ),
);
```

This is already clear. Do not wrap it in a workflow builder just to be consistent.

Use this layer for:

- repository create/update/delete methods
- simple parse-then-query functions
- library internals
- functions with one sync boundary and one async boundary

## Layer 2 — Fluent `Railway.*`

Use fluent `Railway.*` when the code is a named workflow. It carries a growing typed context object through each step.

### Mental Model

```ts
Railway
  .fromSync("profileId", ...)
  // context: { profileId }
  .fromPromise("row", ...)
  // context: { profileId, row }
  .require("profile", "row", ...)
  // context: { profileId, row, profile }
  .derive("normalized", ...)
  // context: { profileId, row, profile, normalized }
  .parallel({ recent: ..., metrics: ... })
  // context: { profileId, row, profile, normalized, recent, metrics }
  .select(...)
```

Each step either adds a named field to context or maps the final context to a result.

### Sync vs Async Mode

`Railway` tracks whether the workflow has crossed an async boundary:

```ts
type RailwayMode = "sync" | "async";

type RailwayOutput<T, E, M extends RailwayMode> =
  M extends "async" ? ResultAsync<T, E> : Result<T, E>;
```

Sync-only workflows return `Result`:

```ts
const parsed = Railway
  .fromSync("id", () => IdSchema.parse(raw), toError)
  .derive("slug", ({ id }) => makeSlug(id))
  .select(({ id, slug }) => ({ id, slug }));

// Result<{ id: Id; slug: string }, Error>
```

Once a workflow uses `fromPromise`, `fromAsync`, or `parallel`, it upgrades to `ResultAsync`:

```ts
const dto = Railway
  .fromSync("id", () => IdSchema.parse(raw), toError)
  .fromPromise("row", ({ id }) => db.query.users.findFirst(...), toError)
  .require("user", "row", ({ id }) => new Error(`User not found: ${id}`))
  .select(({ user }) => toUserDto(user));

// ResultAsync<UserDto, Error>
```

### Example — Drizzle Query + ETL + Parallel Enrichment

```ts
function loadProfileSummary(id: string): ResultAsync<ProfileSummary, Error> {
  return Railway
    // Start sync. Zod parse failures become Err(Error).
    .fromSync("profileId", () => ProfileIdSchema.parse(id), toError)

    // First async boundary. The workflow upgrades from Result to ResultAsync.
    .fromPromise(
      "row",
      ({ profileId }) =>
        db.query.profiles.findFirst({
          where: eq(profiles.id, profileId),
          with: { artifacts: true, jobs: true },
        }),
      toError,
    )

    // Convert nullable Drizzle output into a required profile.
    // If row is null/undefined, short-circuit with this error.
    .require("profile", "row", ({ profileId }) =>
      new Error(`Profile not found: ${profileId}`),
    )

    // Pure sync derivation. Do not catch throws here.
    // Use fromSync if the transform can throw.
    .derive("normalized", ({ profile }) => normalizeProfile(profile))

    // Sync Result-returning ETL step.
    // Err from enrichProfileStats short-circuits the whole workflow.
    .fromResult("stats", ({ normalized }) => enrichProfileStats(normalized))

    // Independent async branches run from the same context.
    // Their named successes merge back into context.
    .parallel({
      recentArtifacts: ({ normalized }) => loadRecentArtifacts(normalized.id),
      jobMetrics: ({ normalized }) => loadJobMetrics(normalized.id),
    })

    // Final projection. Output stays ResultAsync because async appeared above.
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

Use fluent `Railway.*` when it removes manual bridges like:

- `fromResult(...)`
- nested `flatMapResult(...)`
- positional tuple destructuring for parallel work
- manual context-carrying objects after every step

Do not use fluent `Railway.*` when `asyncAfter(...)` is already clearer.

## Layer 3 — Functional `railway(...)`

Use lowercase `railway(...)` when the steps themselves should be reusable values.

```ts
const parseProfileId =
  // Parse raw input and name the output.
  parseWith(ProfileIdSchema, toError).as("profileId");

const loadProfileRow = fromPromiseNamed(
  "row",
  // This reusable step depends on prior named context.
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
  // Error factories can read accumulated context.
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

Use functional `railway(...)` when:

- the same parse/query/require/derive steps appear in multiple workflows
- tests should exercise individual steps
- method chaining would hide the fact that the steps are shared building blocks

Prefer fluent `Railway.*` for one-off service functions.

## Layer 4 — Sync `tryGen`

`tryGen` is a synchronous do-notation escape hatch. It is not the primary service-workflow API.

Use it only when:

- every step is sync
- the function body has nested `flatMapResult` / `mapResult`
- a full `Railway.*` workflow would be overkill

```ts
import { ok, tryGen, yieldResult as $ } from "@onrails/result";

const bundleResult = tryGen<{ artifact: Artifact; chunkData: Chunk[] }, Error>(() => {
  const artifact = $(parseArtifact(raw));
  const chunkTexts = $(chunker.chunk(artifact.content));
  const chunkData = $(parseChunks(artifact, chunkTexts));
  return ok({ artifact, chunkData });
});
```

Use `yieldResult as $` for do-notation snippets in this repo. The alias is intentionally local to `tryGen` blocks and mirrors Rust's `?` ergonomics without changing the rest of the railway API.

Never use `tryGen` with `await` or `ResultAsync`.

```ts
// Wrong: tryGen is sync-only.
tryGen(() => {
  const id = yieldResult(parseId(raw));
  const row = yieldResult(await loadRow(id)); // invalid shape
  return ok(row);
});
```

Async code stays on `ResultAsync.flatMap`, `.andThen`, `asyncAfter`, or a `Railway.*` workflow.

## API Design Notes

### Fluent Starters

`Railway` static methods should start workflows directly:

```ts
Railway.empty()
Railway.context({ profileId })
Railway.fromSync("profileId", () => ProfileIdSchema.parse(id), toError)
Railway.fromResult("settings", () => loadSettings())
Railway.fromPromise("row", () => db.query.users.findFirst(...), toError)
Railway.fromAsync("artifact", () => ingestArtifact(...))
```

Avoid requiring:

```ts
Railway.create().fromSync(...)
```

The static starter form is easier to scan and avoids an empty builder call.

### Instance Steps

Expected instance methods:

```ts
.derive(key, fn)      // pure sync transform
.fromResult(key, fn)  // sync Result-returning step
.fromSync(key, fn)    // throwing sync boundary
.fromPromise(key, fn) // Promise boundary, upgrades to async
.fromAsync(key, fn)   // ResultAsync boundary, upgrades to async
.require(key, source, onMissing)
.parallel(record)
.select(fn)
.done()
```

Recommended semantics:

- `derive` is pure and should not catch throws.
- Use `fromSync` for throwing sync transforms.
- `require` narrows nullable values to non-null fields.
- `parallel` always upgrades to async.
- `select` hides the internal context.
- `done` returns the accumulated context.

## When Not To Use Workflow Syntax

Do not use `Railway.*` or `railway(...)` for:

- a single parse
- a single DB call
- one validation followed by one insert where `asyncAfter` is clearer
- small library combinators
- code where positional tuple output is genuinely clearer than named context

Bad:

```ts
return Railway
  .fromSync("artifact", () => ArtifactSchema.parse(artifact), toError)
  .fromPromise("inserted", ({ artifact }) =>
    getDb().insert(artifacts).values(artifact).then(() => undefined),
    toError,
  )
  .select(() => undefined);
```

Better:

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

The workflow builder earns its keep when it names several domain steps and removes real nesting.

## Refactor Heuristics

Consider fluent `Railway.*` when at least two are true:

- more than three railway steps
- both sync and async boundaries appear
- nullable DB output must become a required value
- independent async branches can run in parallel
- comments explain dataflow because the code shape does not
- prior values must be carried forward through nested closures

Consider functional `railway(...)` when:

- two or more workflows share steps
- step-level tests would be useful
- the same parse/query/require sequence repeats

Consider `tryGen` when:

- all steps are sync
- the current code is a nested `flatMapResult` tree
- a workflow builder would introduce unnecessary named context

Stay low-level when:

- the function has one or two steps
- the code is library internals
- the operation is already readable with `asyncAfter`, `.flatMap`, or `mapResult`

## Maintainer Workflow For Case Studies

Each case study should come from a real downstream PR.

1. Identify the pain point: nested sync chain, mixed sync/async ETL, or reusable workflow steps.
2. Write the low-level current version and the proposed `Railway.*` or `railway(...)` version.
3. Add line comments explaining what each new step does.
4. Confirm the proposed style removes plumbing without hiding important failure behavior.
5. Add the before/after pair to this skill or to package docs.

Keep examples grounded in real code. Synthetic examples are fine for reference sections, but case studies should prove the API pays for itself in production-shaped code.
