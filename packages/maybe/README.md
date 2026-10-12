# @onrails/maybe

Tagged `Maybe` for **expected absence** — cache miss, optional field, not-ready-yet. Not for failures (use `@onrails/result`).

## Install

```bash
bun add @onrails/maybe
```

## Usage

```ts
import { compactMap, fromNullable, isSome, match, some } from "@onrails/maybe";

const row = fromNullable(db.get(id));

const name = match(
  row,
  (r) => r.name,
  () => "guest",
);
```

## Side effects

`tap` runs an effect on the `Some` value, `tapNone` on absence — both pass the
`Maybe` through unchanged. Mirrors `tap`/`tapErr` from `@onrails/result`. Dual-form.

```ts
import { fromNullable, tap, tapNone } from "@onrails/maybe";

const row = fromNullable(db.get(id));

tap(row, (r) => log.debug("hit", r.id)); // runs on Some, returns row
tapNone(row, () => metrics.miss());       // runs on None, returns row
```

## Result boundary

```ts
import { toResult } from "@onrails/maybe/interop";

const user = toResult(fromNullable(row), () => ({ kind: "not_found" as const }));
```

## Prototype carriers

`some()` / `none()` return carriers with `map`, `flatMap` / `andThen`, `match`, `unwrapOr`, `tap` and `tapNone` on a non-enumerable prototype; `JSON.stringify` output is unchanged. Data that went through `JSON.parse`, `structuredClone`, spread or `postMessage` is plain: lift it with `Maybe.from` (`MaybeData<T>` is its input). Hand-written `{ _tag: "Some", value }` literals are no longer `Maybe`; run `onrails-codemod <dir> --literals`. See the Redux / immer notes in [@onrails/result](../result/README.md#breaking-changes).

## Subpaths

| Path | Contents |
|------|----------|
| `@onrails/maybe` | Core |
| `@onrails/maybe/fluent` | `fluent(maybe)` chains |
| `@onrails/maybe/interop` | `toResult`, `fromResult`, `NoneError` |

See [DESIGN.md](./DESIGN.md).
