# @onrails/pattern

Exhaustive matching for owned tagged unions — ts-pattern-shaped API, smaller runtime than full ts-pattern.

## Install

```bash
bun add @onrails/pattern
```

## Usage

```ts
import { match } from "@onrails/pattern";

type Status = "idle" | "running" | "done";

const label = (s: Status) =>
  match(s)
    .with("idle", () => "Idle")
    .with("running", () => "Running")
    .with("done", () => "Done")
    .exhaustive();
```

Object discriminant (shallow key match):

```ts
import { match } from "@onrails/pattern";

const render = (event: { type: "msg"; text: string } | { type: "err"; code: number }) =>
  match(event)
    .with({ type: "msg" }, (e) => e.text) // `e` is narrowed — no cast
    .with({ type: "err" }, (e) => String(e.code))
    .exhaustive();
```

`_tag` unions (`@onrails/result`, `@onrails/maybe`):

```ts
import { matchTag } from "@onrails/pattern/tag";
import { isOk, type Result } from "@onrails/result";

const show = <T, E>(r: Result<T, E>) =>
  matchTag(r, {
    Ok: (v) => v.value,
    Err: (e) => e.error,
  });
```

## Subpaths

| Path | Contents |
|------|----------|
| `@onrails/pattern` | `match`, `when`, `assertNever` |
| `@onrails/pattern/tag` | `matchTag` |

See [DESIGN.md](./DESIGN.md).
