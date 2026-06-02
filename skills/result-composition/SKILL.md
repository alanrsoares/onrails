---
name: result-composition
description: Primitive composition patterns for `@onrails/result` and `@onrails/maybe` — dual-form transforms, variadic `pipe`, variadic `flow`, point-free pipelines, the closure ladder. Use when writing or refactoring TypeScript that composes `Result` / `Maybe` transforms, when nesting `flatMap` calls feels noisy, when a reusable composed function would be cleaner than a wrapped expression, or when a user asks about "pipe", "flow", "compose", "point-free", "data-last", "dual-form", "curried Result", "tacit", "Ramda-style", or "nested flatMap". Do NOT use for full named-step service workflows — see the `railway-do-notation` skill for the workflow-builder layer above this one.
---

# Primitive composition in `@onrails/result`

This skill covers how to compose `Result` / `Maybe` transforms at the primitive layer — before reaching for a workflow builder. The dual-form API + variadic `pipe` / `flow` give you Ramda-shape point-free composition with full TS inference.

For named multi-step service workflows (Drizzle ETL, parallel enrichment, required nullable fields), escalate to the **`railway-do-notation`** skill.

For worked examples of the patterns below, see [`packages/result/RECIPES.md`](../../packages/result/RECIPES.md).

## The dual-form contract

Every transform in `@onrails/result` and `@onrails/maybe` accepts **two call shapes**:

```ts
map(result, fn);   // data-first — best inference for one-shot inline calls
map(fn)(result);   // data-last (curried) — feeds pipe(...) and flow(...)
```

Arity at the call site picks the overload. Same applies to `mapErr`, `bimap`, `flatMap`, `recover`, `tap`, `tapErr`, `match`.

`match` and `bimap` use 3-args data-first, 2-args curried:

```ts
match(result, onOk, onErr);          // data-first
match(onOk, onErr)(result);          // data-last
```

## Decision tree

Use the smallest tool that makes the code clear:

| Shape | Reach for |
|-------|-----------|
| One-shot inline transform | `map(r, fn)` — data-first; TS infers `T` from `r` |
| 3+ sequential steps from a starting value | `pipe(value, map(fn), flatMap(g), ...)` |
| Defining a reusable composed function | `flow(map(fn), flatMap(g), ...)` returning `(value) => Result<…>` |
| Method-chain in expression position | `r.map(fn).flatMap(g)` on `ResultAsync` (class method) |
| 4+ named domain steps, mixed sync/async, nullable DB rows | **stop — use `railway-do-notation` skill** |

## `pipe` vs `flow` — the only difference

```ts
pipe(value, f, g, h)   === h(g(f(value)));   // value applied immediately
flow(f, g, h)(value)   === h(g(f(value)));   // returns a reusable function
pipe(x, ...fns) === flow(...fns)(x);         // formal identity
```

Both are **left-to-right** (like Ramda's `R.pipe`, fp-ts `flow`, Effect `flow`). Not right-to-left `compose`.

Use `pipe` when you have the starting value at the call site. Use `flow` when you want to define a function once and apply it later.

## The closure ladder

The decision between `flow`, `pipe`, and an outer HOF wrapper depends on **what each step needs to read**:

| Step needs to read… | Shape |
|---------------------|-------|
| Nothing from outside the carrier value | `flow(step1, step2, ...)` — pure point-free |
| Per-call configuration that doesn't change with the data | `(cfg) => flow(step1(cfg), step2(cfg), ...)` — outer HOF closes over config |
| The original entry value mid-pipeline (e.g. retry coordinate) | `(input) => pipe(input, step1, step2, ...)` — closure over input, use `pipe` |

Each row up adds one closure layer. Picking the right row keeps the code as point-free as the actual data flow allows — no more, no less.

## Layer 1 — Direct dual-form calls

For one or two transforms, just call the dual-form fn directly:

```ts
import { map, flatMap, ok, err } from "@onrails/result";

const trimmed = map(parsedConfig, (cfg) => cfg.name.trim());
const validated = flatMap(trimmed, (name) =>
  name.length > 0 ? ok(name) : err({ kind: "empty" as const }),
);
```

This is already clear. Don't wrap two calls in a `pipe` just to be consistent.

## Layer 2 — Variadic `pipe`

Reach for `pipe(value, ...fns)` when:

- 3+ sequential steps starting from a known value
- the chain reads top-to-bottom with each line doing one obvious thing
- intermediate results don't need to be named

```ts
import { pipe, map, flatMap, recover, tap } from "@onrails/result";

const greeting = pipe(
  parseConfig(raw),
  map((cfg) => cfg.user),
  flatMap((u) => (u.name ? ok(u.name) : err({ kind: "empty" as const }))),
  recover((e) => (e.kind === "empty" ? ok("anon") : err(e))),
  tap((name) => log.info({ msg: "resolved", name })),
);
// Result<string, ParseError>
```

`pipe` slots arbitrary `(prev) => next` functions, so non-curried steps work too:

```ts
pipe(
  validated,
  (value) => asyncAfter(value, (v) => tryAsync(persist(v))),
);
```

Don't fight the railway — when a step is naturally value-first (`asyncAfter`, `pipe(value, ...)` inside a step, etc.), embed the call directly.

## Layer 3 — Variadic `flow`

Use `flow(...fns)` to **define reusable composed functions** without mentioning the data:

```ts
import { flow } from "@onrails/result/pipe";
import { flatMap, map, type Result } from "@onrails/result";

// Result-track mini-pipeline — takes raw, returns Result.
const parseAndValidate = flow(parseJson, flatMap(validateSchema));

// Value-track mini-pipeline — takes Ok value, returns Result. Lifted by `flatMap`.
const enrichAndPersist = flow(addTimestamp, persist);

// flow is associative — flow(flow(a, b), c) === flow(a, b, c).
const ingest = flow(parseAndValidate, flatMap(enrichAndPersist));
// (raw: string) => Result<Saved, ParseError | SchemaError | DbError>
```

`flow` shines when the same composition is reused across call sites, or when naming the mini-pipeline (`parseAndValidate`) clarifies intent.

## Layer 4 — Strategy-parametrised flows (HOF + `flow`)

When a step needs configuration that doesn't change per-call, take it on an outer factory. Inner `flow` stays point-free over the data:

```ts
import { flow } from "@onrails/result/pipe";
import { map, recover, ok, err } from "@onrails/result";

const fetchWith = (cfg: { fallback?: Body; rethrow: (e: FetchError) => boolean }) =>
  flow(
    fetchSync,
    recover((e: FetchError) =>
      cfg.rethrow(e) || !cfg.fallback ? err(e) : ok(cfg.fallback),
    ),
    map((body: Body) => body.byteLength),
  );

const fetchOrEmpty = fetchWith({ fallback: emptyBody, rethrow: (e) => e.kind === "fatal" });
// (url: string) => Result<number, FetchError>
```

The outer fn captures *what varies between definitions*; the inner `flow` captures *what varies per-call*. Same shape as recipe #10 in `RECIPES.md`.

## Anti-patterns

### 1. Compose direction confusion

`flow` is **left-to-right**. The first fn is the entry point, not the last:

```ts
// Right:
flow(fetchSync, recover(handler));   // (url) => recover(handler)(fetchSync(url))

// Wrong (Ramda compose habit):
flow(recover(handler), fetchSync);   // recover called first with `url`, type-fails
```

If you want right-to-left `compose`, build it on top in one line — but in practice, just use `flow` and read top-to-bottom.

### 2. Closure-over-input in `flow`

`flow(...)` has no lexical access to the eventual call argument. If a step needs to reference the entry value (e.g. retry with the original URL inside `recover`), you must wrap `flow` in a function-of-input:

```ts
// Wrong — `url` is undefined in the recover closure:
const fetchWithBackoff = flow(
  fetchSync,
  recover((e) => fetchSync(url)),   // `url` is not in scope
);

// Right — wrap so recover closes over the outer parameter:
const fetchWithBackoff = (url: string) =>
  pipe(
    url,
    fetchSync,
    recover((e) => fetchSync(url)),
  );
```

Decide via the closure ladder above: any step that looks back at the original input forces row 3 (wrap in `(input) => pipe(input, ...)`).

### 3. Point-free where a step needs the same value three times

When one intermediate value is referenced multiple times in branchy logic, `flatMap` chains start carrying ambient state and reading inverted. Drop into `tryGen`:

```ts
import { tryGen, $ } from "@onrails/result/try-gen";

const ingest = (raw: string) =>
  pipe(
    raw,
    parseUser,
    (validated) =>
      tryGen(() => {
        const user = $(validated);
        const enriched = $(enrichWithAcl(user));
        const persisted = $(persistSync(enriched));
        return ok({ user: persisted, at: Date.now() });
      }),
    mapErr((e) => ({ kind: "ingest" as const, cause: e })),
  );
```

`tryGen` is a sync island. Use it when:

- the same value is referenced 3+ times
- conditional branching makes the `flatMap` chain feel inverted
- you want `?`-style early returns without method-chaining

### 4. Inference noise mid-chain

If a `pipe` accumulates two or more `as const` casts between steps, TS is telling you the carrier type is fighting back. Either:

- annotate the carrier type explicitly with a typed intermediate variable, or
- revert that step to a named one-shot and continue the pipe after it.

Point-free should reduce noise, not add it.

## When to escalate

When you find yourself reaching for **any** of:

- named context carrying values forward across many steps
- mixed sync + async boundaries with `fromResult` / `asyncAfter` plumbing on every line
- nullable Drizzle rows that must become required values
- independent async branches that should run in parallel and merge by name

…**stop and switch to the `railway-do-notation` skill**. `Railway.*` and `railway(...)` are designed for that territory and will read better than any amount of `pipe`/`flow` plumbing.

## When NOT to go point-free

`flow` and `pipe` are tools, not goals. Pipelines should read top-to-bottom with each step doing one obvious thing. Reach for `pipe` when:

- 3+ sequential steps
- each step has a clear *what*, not a clever *how*
- errors compose cleanly via `mapErr` / `recover`

Avoid point-free when:

- the pipeline branches on the value mid-flight in non-obvious ways — use `tryGen` or escalate to `Railway`
- a single step needs three different references to the same intermediate value — name it with `flatMap((x) => { ... })` and stop pretending it's anonymous
- TypeScript inference gets noisy (multiple `as const` casts mid-chain) — annotate or revert

The dual-form API lets you mix both styles freely: start point-free, drop to a named step when clarity beats compression.

## See also

- [`packages/result/RECIPES.md`](../../packages/result/RECIPES.md) — 11 worked recipes covering parser builders, ETL pipelines, strategy-parametrised flows, validator ladders, Maybe → Result crossings, parallel sub-workflows, `tryGen` escape hatches.
- [`railway-do-notation`](../railway-do-notation/SKILL.md) — workflow-builder layer above this one. Use when named context wins over positional plumbing.
