# RFC 0001 — API coherence across `result` / `maybe` / `pattern`

**Status:** accepted
**Scope:** naming, aliases, and surface placement. No runtime behavior changes except where flagged.

The core trio is coherent where it counts — one tagged-union data model, uniform
dual-form transforms, mirrored channel naming (`tapErr` ↔ `tapNone`). The
incoherence is accumulated generosity: synonyms, duplicate helpers, and a few
names that hide sharp edges. Each section below shows the pain as it reads in
real consumer code today, then the proposed canonical syntax.

Guiding rule: **one canonical name per operation, per carrier.** Aliases exist
only as a documented neverthrow-compat tier, marked `@deprecated` everywhere
else, removed at the next major.

---

## 1. Three `match`es, three fold shapes

### Pain

Any file touching two packages renames on import — our own codemod CLI does:

```ts
// packages/codemod/src/cli.ts — today
import { type Maybe, match as matchMaybe, none, some, tap } from "@onrails/maybe";
import { match } from "@onrails/pattern";
```

And `@onrails/result` alone ships **three shapes for the same fold**:

```ts
match(result, onOk, onErr);                 // dual-form positional
matchResult(result, onOk, onErr);           // collision-rename alias of the above
fold({ ok: onOk, err: onErr })(result);     // curried-only, object handlers
```

A reader meeting `fold` next to `match` has no way to know they are the same
operation with different calling conventions.

### Proposal

`match` stays the canonical fold on `result` and `maybe` — it already mirrors
across both (`onOk/onErr` ↔ `onSome/onNone`). `pattern` keeps the bare `match`;
the name *is* the domain. The collision dissolves by convention, not by API:
**namespace-import carriers in mixed files.**

```ts
// 1. Single-carrier file (Canonical bare imports)
import { match } from "@onrails/result";

match(result, onOk, onErr); // Data-first positional

// 2. Curried (data-last) form replacing the deprecated `fold`
// Deprecated: fold({ ok: onOk, err: onErr })(result)
match(onOk, onErr)(result);

// 3. Mixed-carriers file (Proposed namespace-import house style)
import * as Maybe from "@onrails/maybe";
import * as R from "@onrails/result";
import { match } from "@onrails/pattern";   // pattern owns the bare name

R.match(result, onOk, onErr);
Maybe.match(cached, useRow, refetch);
match(event).with({ kind: "click" }, onClick).exhaustive();
```

Reads as English, survives tree-shaking (`sideEffects: false`), and scales to
every future collision (`map`, `tap`, `flatMap` already collide silently when
both packages are imported).

Deprecate: `matchResult`, `matchMaybe` (the apology aliases), and `fold`
(object-handler shape; its one advantage — named branches — is better served by
`pattern` when branches multiply).

---

## 2. Three names per operation

### Pain

All of these are the same method; a codebase can pass `bun check` using all
three in adjacent files:

```ts
ra.flatMap(loadProfile)
  .andThen(loadMetrics)   // alias
  .chain(loadFlags);      // alias of the alias
```

Same for `recover`/`orElse`, `getOrElse`/`unwrapOr`, `of`/`ok`/`some`,
`combineTuple`/`sequenceTupleAsync`. Every synonym doubles the vocabulary a
reviewer must hold.

### Proposal

One canonical column; one documented compat column; everything else deprecated.

| Operation        | Canonical        | neverthrow-compat (kept) | Deprecated        |
| ---------------- | ---------------- | ------------------------ | ----------------- |
| bind             | `flatMap`        | `andThen`                | `chain`           |
| error bind       | `recover`        | `orElse`                 | —                 |
| fold             | `match`          | —                        | `matchResult`, `matchMaybe`, `fold` |
| default          | `unwrapOr`       | —                        | `getOrElse`       |
| lift             | `ok` / `some`    | —                        | `of`              |
| tuple combine    | `combineTuple`   | —                        | `sequenceTupleAsync`* |

\* `parallelTupleAsync` stays — it names different *behavior* (wall-clock
overlap), not a synonym.

The compat column is exactly what the codemod understands; it already rewrites
`chain → flatMap` and `orElse → recover` for consumers going native. Enforcement:
one grit rule in `@onrails/biome-plugin` flagging the deprecated column in
non-`compat` source.

```ts
import { pipe, flatMap, recover, unwrapOr, ok } from "@onrails/result";

// 1. Canonical point-free pipelined transformations
const profile = pipe(
  loadProfile(userId),
  flatMap(loadMetrics),             // Canonical (instead of deprecated chain / andThen)
  recover((e) => ok(fallback(e))),  // Canonical (instead of deprecated orElse)
  unwrapOr(defaultProfile)          // Canonical (instead of deprecated getOrElse)
);

// 2. Canonical fluent wrapper transformations (allowed at application edges)
import { fluent } from "@onrails/result/fluent";

const profileFluent = fluent(loadProfile(userId))
  .flatMap(loadMetrics)
  .recover((e) => ok(fallback(e)))
  .unwrapOr(defaultProfile);

// 3. Canonical tuple combination
import { combineTuple, ResultAsync } from "@onrails/result";

// Sync
const syncTuple = combineTuple([ok(1), ok("a")] as const);

// Async (sequential)
const asyncTuple = ResultAsync.combineTuple([fetchUser(id), fetchConfig(id)] as const);
// (Note: sequenceTupleAsync is deprecated; use static ResultAsync.combineTuple)
```

---

## 3. `collect` is `combine` re-implemented

### Pain

Two modules, one semantics, line-for-line:

```ts
// @onrails/result (result.ts)
combine([ok(1), ok(2), err("x")]);   // Err("x") — short-circuits on first Err

// @onrails/result/extra (extra.ts)
collect([ok(1), ok(2), err("x")]);   // Err("x") — identical loop, even builds
                                     // the Ok with a raw { _tag: "Ok" } literal
```

Reviewers must diff implementations to learn there is no difference.

### Proposal

```ts
// extra.ts — proposed
/** @deprecated Identical to {@link combine}; removed in the next major. */
export const collect = combine;
```

Delegation now, deletion at the next major.

```ts
// Deprecated:
// import { collect } from "@onrails/result/extra";
// const res = collect([ok(1), ok(2)]);

// Canonical:
import { combine } from "@onrails/result";
const res = combine([ok(1), ok(2)]);
```

---

## 4. Throwing functions with neutral names

### Pain

The quality bar says "no `throw` in business logic", the eslint plugin flags
neverthrow's honestly-named `_unsafeUnwrap` — and then the codemod rewrites it
to a name that no longer warns:

```ts
// before codemod — screams at the call site
const user = result._unsafeUnwrap();

// after codemod — reads safe, still throws on Err
const user = unwrapOk(result);
```

`unwrapOk`, `unwrapErr`, and `Maybe.unwrap` are the only throwing exports in
the libs, and their names are the only ones that don't say so.

### Proposal

No rename (the codemod target and existing consumers stay stable). Instead,
treat them as the **test/assertion tier** and enforce it:

```ts
/**
 * Returns the Ok value.
 * @throws when the result is Err — assertion-tier; use match/unwrapOr in
 * business logic. Allowed in *.spec.ts; flagged elsewhere by the plugins.
 */
export const unwrapOk = ...
```

- `@onrails/eslint-plugin` `no-unsafe-unwrap` extends its match list with
  `unwrapOk` / `unwrapErr` / `unwrap` outside `*.spec.ts` / `*.test.ts`
  (today it only knows the `_unsafeUnwrap*` spellings).
- Same rule added to `@onrails/biome-plugin`.

```ts
// In business logic:
// Canonical (safe, compiler-enforced handling):
const user = match(
  result,
  (okVal) => okVal,
  (errVal) => fallbackUser
);
// or:
const user = unwrapOr(result, fallbackUser);

// Deprecated / Flagged in business logic (will throw if Err):
// const user = unwrapOk(result); // OK only in *.spec.ts / *.test.ts
```

---

## 5. `ResultAsync.isOk()` / `isErr()` — racy, non-narrowing, double-executing

### Pain

The predicate methods return `Promise<boolean>`, which cannot narrow — and each
call re-runs the underlying factory. For deferred work that means **double
execution of IO**:

```ts
const insert = ResultAsync.defer(() => db.orders.insert(row));

if (await insert.isOk()) {     // insert ran once...
  const r = await insert;      // ...and now it ran AGAIN
  // r is Result<Row, E> — still needs isOk(r) to narrow anyway
}
```

The check bought nothing (no narrowing) and cost a duplicate INSERT.

### Proposal

Deprecate both methods. The replacement is shorter and narrows:

```ts
import { isOk, isErr } from "@onrails/result";

const r = await insert;        // one execution — thenable yields Result<Row, E>

if (isOk(r)) {
  console.log(r.value);        // narrowed to Row
} else {
  console.log(r.error);        // narrowed to E
}

// Alternatively, using isErr:
if (isErr(r)) {
  handleError(r.error);
}
```

```ts
/** @deprecated Await the ResultAsync and narrow with isOk(r) — this method
 *  re-executes deferred factories and cannot narrow. */
isOk(): Promise<boolean> { ... }
```

**Open question (behavior change, separate decision):** memoize `resolve()` so
every `ResultAsync` settles its factory at most once. That would fix the
double-execution class entirely but changes `defer` retry semantics — needs its
own RFC if wanted.

---

## 6. Surface placement: `mcp` and `extra`

### Pain

`@onrails/result` self-describes as "library-only railway primitives", yet:

```ts
// @onrails/result/mcp — MCP tool-response formatting inside the primitives lib
toToolResponse(result);   // { content: [{ type: "text", ... }], isError }
```

And `./extra` is a name that promises nothing and contains tagged-error
utilities (`declareErrors`, `hasKind`, `mapErrKind`) plus the `collect`
duplicate from §3.

### Proposal

- `mcp.ts` → **Drop entirely.** Do not extract to a separate package. This type of application-specific integration boundary has no place in the primitives library. Deprecate the `@onrails/result/mcp` subpath in the next minor, and delete it in the major.
- `extra.ts` → after `collect` delegates (§3), what remains is coherent
  tagged-error tooling. Keep the published subpath, retitle its docs to
  "tagged-error helpers", and stop calling it `extra` anywhere prose appears.

```ts
// MCP Response formatting:
// Deprecated and to be removed entirely (handle formatting at application boundaries):
// import { toToolResponse } from "@onrails/result/mcp";

// Tagged-error utilities:
// Canonical (kept on extra subpath but rebranded as tagged-error helpers):
import { declareErrors, hasKind } from "@onrails/result/extra";
```

---

## 7. Seven ways to compose (docs decision, not API)

### Pain

A new contributor can write the same workflow as a method chain, curried
`pipe`, data-first calls, `flow`, `tryGen`, `Railway`, or `railway()` steps —
all lint-clean. Teams fragment by author.

### Proposal

No API change. Codify the four-tier rule (it half-exists in AGENTS.md) at the
top of README and RECIPES, with the others positioned as specializations:

| Tier | Use Case | Recommended Pattern |
| ---- | -------- | ------------------- |
| **1** | 1–2 steps, linear | direct data-first calls or method chains |
| **2** | 3+ steps, linear | `pipe` or `flow` |
| **3** | branchy, value reused | `tryGen` escape hatch |
| **4** | 4+ named steps, mixed IO | `Railway` or `railway()` steps |

`/fluent` is documented as app-edge sugar only — never in library or service
internals.

```ts
// Tier 1: 1–2 steps, linear -> direct data-first call
const normalized = map(rawResult, normalize);

// Tier 2: 3+ steps, linear -> pipe / flow
const process = flow(
  map(normalize),
  flatMap(validate),
  recover(fallback)
);

// Tier 3: Branchy, value reused -> tryGen
import { tryGen, $ } from "@onrails/result/try-gen";

const stepResult = tryGen(() => {
  const user = $(authenticate(req));
  const post = $(fetchPost(postId));
  if (post.authorId !== user.id && !user.isAdmin) {
    return err({ kind: "unauthorized" as const });
  }
  return ok(post);
});

// Tier 4: 4+ named steps, mixed IO -> Railway context builder
import { Railway } from "@onrails/result/railway";

const workflow = Railway
  .fromSync("id", () => IdSchema.parse(raw), toError)
  .fromPromise("row", ({ id }) => db.profiles.find(id), toError)
  .require("profile", "row", ({ id }) => ({ kind: "not_found" as const, id }))
  .derive("normalized", ({ profile }) => normalizeProfile(profile))
  .select(({ normalized }) => normalized);
```

---

## Migration mechanics

1. **Minor release:** add `@deprecated` JSDoc (per §1–§5), `collect = combine`
   delegation, plugin rule extensions, README four-tier table. Zero breaking
   changes — editors strike through, plugins warn.
2. **Next major:** delete the deprecated column of §2's table, `fold`,
   `matchResult`/`matchMaybe`, `collect`, `ResultAsync.isOk/isErr`, and the
   `mcp` subpath.
3. The codemod already emits only canonical + compat names, so migrated
   consumers never see the deprecated tier.
