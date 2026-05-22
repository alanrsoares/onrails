# @onrails/pattern — design

Lightweight matching for **owned** tagged unions and finite domain states. Inspired by ts-pattern; aligned with `@onrails/result` DX.

## Goals

- **Smaller runtime** than ts-pattern — shallow object match, literal/primitive equality, guards
- **ts-pattern-shaped API**: `match(x).with(...).exhaustive()` / `.otherwise()`
- **`matchTag`** for `_tag` unions (`Ok` / `Err`, `Some` / `None`, domain ADTs)
- No `P.*` wildcard zoo in v1 — use `when(guard)` or `matchTag`

## Handler narrowing

`.with({ type: "message" }, (e) => …)` narrows `e` via `Narrow<T, P>` (`Extract` for object patterns). Guards use `when(fn)`.

## Type tests

`test/types.spec.ts` uses `ts-expect` (`expectType` + `TypeEqual`) — same approach as styled-cva.

## Non-goals (v1)

- Deep/spread patterns, `P.select`, `P.not`, nested unwrapping
- Compile-time proof of exhaustiveness (use `assertNever` + discipline; runtime throw on miss)
- Replacing `if` for two-branch checks or nullable guards

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/pattern` | `match`, `when`, `assertNever` |
| `@onrails/pattern/tag` | `matchTag` for `_tag` dispatch |

## Migration from ts-pattern

| ts-pattern | @onrails/pattern |
|------------|------------------|
| `match(x).with({ type: "a" }, fn).exhaustive()` | Same |
| `match(x).with("a", fn).exhaustive()` | Same (primitive / literal union) |
| `P.when(fn)` | `when(fn)` |
| `P._` / nested selects | Not v1 — keep ts-pattern or refactor to `matchTag` |

## Deferred

- `compat/ts-pattern` re-export or codemod
- Narrowing helpers per `.with` branch
