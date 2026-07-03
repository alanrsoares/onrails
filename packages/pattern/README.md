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

Type-predicate guards via `when`:

```ts
import { match, when } from "@onrails/pattern";

type Event = { type: "msg"; text: string } | { type: "err"; code: number };
const isMsg = (e: Event): e is Extract<Event, { type: "msg" }> => e.type === "msg";

const render = (e: Event) =>
  match(e)
    .with(when(isMsg), (msg) => msg.text)            // `msg` narrowed to { type: "msg"; text: string }
    .otherwise(() => "");
```

Lock the result type with `returnType<R>()` when branch inference would otherwise widen too narrowly:

```ts
import type { ReactNode } from "react";
import { match } from "@onrails/pattern";

const render = (p: Part): ReactNode =>
  match(p)
    .returnType<ReactNode>()                          // every `.with` handler must return ReactNode
    .with({ type: "text" }, (t) => <Text>{t.text}</Text>)
    .with({ type: "image" }, (i) => <Image src={i.src} />)
    .otherwise(() => null);
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
| `@onrails/pattern` | `match`, `when`, `assertNever`, `MatchBuilder` |
| `@onrails/pattern/tag` | `matchTag` |

See [DESIGN.md](./DESIGN.md).
