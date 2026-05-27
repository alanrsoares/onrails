# Recipes — point-free composition

A cookbook of functional composition patterns built on `@onrails/result` + `@onrails/maybe`. Every transform in the core API is **dual-form** — call it data-first for one-shots, or data-last (curried) for point-free pipelines:

```ts
map(result, fn);   // data-first — best inference for one-shot calls
map(fn)(result);   // curried, data-last — feeds `pipe(...)` and `flow(...)`
```

`pipe(value, ...fns)` is variadic value-first composition. `flow(...fns)` is the same thing for **defining** a reusable composed function. Both consume the curried (data-last) overload.

See [README.md](./README.md) for the API reference and decision tree.

---

## 1. Reusable parser builder via `flow`

Define a parser factory once, instantiate per schema.

```ts
import { flow } from "@onrails/result/pipe";
import { flatMap, trySync, type Result } from "@onrails/result";

type ParseError = { kind: "parse"; message: string };
type SchemaError = { kind: "schema"; field: string };

const parseJsonWith = <T>(schema: { parse: (x: unknown) => T }) =>
  flow(
    trySync(
      (raw: string) => JSON.parse(raw),
      (e): ParseError => ({ kind: "parse", message: String(e) }),
    ),
    flatMap((data: unknown) =>
      trySync(
        () => schema.parse(data),
        (e): SchemaError => ({ kind: "schema", field: String(e) }),
      )(),
    ),
  );

const parseUser = parseJsonWith(UserSchema);
const parseOrder = parseJsonWith(OrderSchema);
// (raw: string) => Result<User, ParseError | SchemaError>
```

Why point-free: the parser's *input* never appears in the definition. Reuse the factory across every schema without binding the data shape.

---

## 2. ETL pipeline: parse → validate → enrich → persist

A typical service-layer flow chains sync validation with async IO.

```ts
import { ok, err, pipe, flatMap, mapErr, tap } from "@onrails/result";
import { asyncAfter, tryAsync } from "@onrails/result";

type DbError = { kind: "db"; cause: unknown };

const saveOrder = (rawJson: string) =>
  pipe(
    rawJson,
    parseUser,                                                            // Result<User, ParseError | SchemaError>
    flatMap((u) => (u.active ? ok(u) : err({ kind: "inactive" as const }))),
    mapErr((e) => ({ kind: "input" as const, cause: e })),
    tap((u) => log.info({ msg: "validated", userId: u.id })),
    (validated) =>
      asyncAfter(validated, (u) =>
        tryAsync(
          db.orders.insert({ userId: u.id, items: u.cart }),
          (e): DbError => ({ kind: "db", cause: e }),
        ),
      ),
  );
// ResultAsync<OrderRow, { kind: "input"; cause: ... } | DbError>
```

The last step isn't perfectly point-free because `asyncAfter` is value-first by design (it takes the sync Result, then the async bridge). That's fine — `pipe` slots arbitrary `(prev) => next` functions, point-free or not.

---

## 3. Tagged-error unification across sources

Three call sites return three error shapes. `mapErr` data-last unifies them into one app-level union.

```ts
import { pipe, flatMap, mapErr } from "@onrails/result";

type AppError =
  | { kind: "auth";   reason: string }
  | { kind: "http";   status: number }
  | { kind: "decode"; field: string };

const loadDashboard = (token: string) =>
  pipe(
    token,
    verifyToken,                                                          // Result<Session, "expired" | "bad_sig">
    mapErr((reason): AppError => ({ kind: "auth", reason })),
    flatMap(fetchProfileSync),                                            // Result<Profile, { status: number }>
    mapErr((e): AppError => ("status" in e ? { kind: "http", status: e.status } : e)),
    flatMap(decodeProfile),                                               // Result<DTO, { field: string }>
    mapErr((e): AppError => ("field" in e ? { kind: "decode", field: e.field } : e)),
  );
// Result<DTO, AppError>
```

Every `mapErr` is a data-last partial — drops into `pipe` without a wrapping `(result)`.

---

## 4. Maybe → Result railway crossing

When "missing" becomes a domain failure at a specific boundary.

```ts
import { flow } from "@onrails/result/pipe";
import { map } from "@onrails/result";
import { fromNullable } from "@onrails/maybe";
import { toResult } from "@onrails/maybe/interop";

type RowMissing = { kind: "not_found"; id: string };

const requireRow = <T>(loader: (id: string) => T | null | undefined) =>
  flow(
    (id: string) =>
      toResult(
        fromNullable(loader(id)),
        (): RowMissing => ({ kind: "not_found", id }),
      ),
    map((row: T) => ({ ...row, loadedAt: Date.now() })),
  );

const requireUser = requireRow(userCache.get);
const requireOrder = requireRow(orderCache.get);
// (id: string) => Result<User & { loadedAt: number }, RowMissing>
```

`Maybe` models expected absence; `toResult` is the explicit boundary where absence converts to a typed domain failure.

---

## 5. Parallel sub-workflows + downstream merge

Three independent async loads overlap in wall-clock time; downstream `.map` reshapes the tuple.

```ts
import { pipe, parallelTupleAsync } from "@onrails/result";

type ProfileError = { kind: "profile"; cause: unknown };
type MetricsError = { kind: "metrics"; cause: unknown };

const buildSummary = (userId: string) =>
  pipe(
    parallelTupleAsync([
      loadProfile(userId),                                                // ResultAsync<Profile, ProfileError>
      loadRecentMetrics(userId),                                          // ResultAsync<Metrics, MetricsError>
      loadFeatureFlags(userId),                                           // ResultAsync<Flags,   never>
    ] as const),
    (combined) =>
      combined.map(([profile, metrics, flags]) => ({
        userId,
        name: profile.name,
        score: metrics.score,
        features: flags.enabled,
      })),
  );
// ResultAsync<Summary, ProfileError | MetricsError>
```

`parallelTupleAsync` preserves tuple positions, so destructuring stays type-safe. Use `sequenceTupleAsync` if branches must run left-to-right.

---

## 6. Reusable validator ladder via `flow` + `recover`

Compose validators data-last; `recover` re-tags or rescues specific error kinds.

```ts
import { flow } from "@onrails/result/pipe";
import { flatMap, recover, ok, err } from "@onrails/result";

type LengthError = { kind: "len"; min: number };
type CharsError  = { kind: "chars"; bad: string };

const requireMin = (min: number) =>
  flow((s: string) => (s.length >= min ? ok(s) : err({ kind: "len" as const, min })));

const requireAscii = flow(
  (s: string) =>
    /^[\x20-\x7e]*$/.test(s) ? ok(s) : err({ kind: "chars" as const, bad: s }),
);

const validateUsername = flow(
  (raw: string) => ok(raw.trim()),
  flatMap(requireMin(3)),
  flatMap(requireAscii),
  recover((e: LengthError | CharsError) =>
    e.kind === "len" ? err({ kind: "too_short" as const, min: e.min }) : err(e),
  ),
);
// (raw: string) => Result<string, { kind: "too_short"; min: number } | CharsError>
```

`requireMin(3)` is a curried factory — `flow` strings it into the pipeline alongside `requireAscii`. None of the inner steps mention the value.

---

## 7. `tryGen` escape hatch for branchy logic

When a single value gets consumed multiple times in branchy logic, point-free flatMap chains get awkward. Drop into `tryGen` and rejoin the pipe.

```ts
import { ok, pipe, mapErr } from "@onrails/result";
import { tryGen, $ } from "@onrails/result/try-gen";

const ingest = (raw: string) =>
  pipe(
    raw,
    parseUser,
    (validated) =>
      tryGen(() => {
        const user = $(validated);                   // unwrap or short-circuit
        const enriched = $(enrichWithAcl(user));
        const persisted = $(persistSync(enriched));
        return ok({ user: persisted, at: Date.now() });
      }),
    mapErr((e) => ({ kind: "ingest" as const, cause: e })),
  );
```

`tryGen` is a sync island. Use it when:
- The same intermediate value is referenced three or more times.
- Conditional branching makes the `flatMap` chain feel inverted.
- You want `?`-style early returns without method-chaining.

Use `pipe` everywhere else — it composes better and reads top-to-bottom.

---

## 8. Conditional recovery with `recover` + targeted re-throw

`recover` is the error-track bind. Recover only the kinds you can handle; pass the rest through.

```ts
import { pipe, flatMap, recover, ok, err } from "@onrails/result";

type NetworkError = { kind: "network"; retryable: boolean };
type RateLimit    = { kind: "rate_limit"; retryAfter: number };
type Fatal        = { kind: "fatal";  message: string };

const fetchWithBackoff = (url: string) =>
  pipe(
    url,
    fetchSync,                                                            // Result<Body, NetworkError | RateLimit | Fatal>
    recover((e: NetworkError | RateLimit | Fatal) => {
      if (e.kind === "network" && e.retryable) return fetchSync(url);
      if (e.kind === "rate_limit") return err(e);   // bubble up — caller schedules retry
      if (e.kind === "fatal") return err(e);        // unrecoverable
      return err(e);
    }),
  );
// Result<Body, NetworkError | RateLimit | Fatal>
```

---

## When NOT to go point-free

Pipelines should read top-to-bottom and each step should do one obvious thing. Reach for `pipe` when:

- ≥ 3 sequential steps.
- Each step has a clear *what*, not a clever *how*.
- Errors compose cleanly via `mapErr` / `recover`.

Avoid point-free when:

- The pipeline branches on the value mid-flight in non-obvious ways — use `tryGen` or `Railway` for named context.
- A single step needs three different references to the same intermediate value — name it with `flatMap((x) => { ... })` and stop pretending it's anonymous.
- TypeScript inference gets noisy (multiple `as const` casts mid-chain). Either annotate the carrier type, or revert that step to a named one-shot.

The dual-form lets you mix both — start point-free, drop to a named step when clarity beats compression.
