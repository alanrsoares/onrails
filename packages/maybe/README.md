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

const name = match(row, {
  some: (r) => r.name,
  none: () => "guest",
});
```

## Result boundary

```ts
import { toResult } from "@onrails/maybe/interop";

const user = toResult(fromNullable(row), () => ({ kind: "not_found" as const }));
```

## Subpaths

| Path | Contents |
|------|----------|
| `@onrails/maybe` | Core |
| `@onrails/maybe/fluent` | `fluent(maybe)` chains |
| `@onrails/maybe/interop` | `toResult`, `fromResult`, `NoneError` |

See [DESIGN.md](./DESIGN.md).
