# @onrails/pattern — design

Lightweight matching for **owned** tagged unions and finite domain states. Inspired by ts-pattern; aligned with `@onrails/result` DX.

## Goals

- **Smaller runtime** than ts-pattern — shallow object match, literal/primitive equality, guards
- **ts-pattern-shaped API**: `match(x).with(...).exhaustive()` / `.otherwise()`
- **`matchTag`** for `_tag` unions (`Ok` / `Err`, `Some` / `None`, domain ADTs)
- No `P.*` wildcard zoo in v1 — use `when(guard)` or `matchTag`

## Handler narrowing

`.with(pattern, handler)` narrows the handler's input via `Narrow<T, P>`:

- **Discriminated union**: `Extract<T, P>` picks the matching member.
- **Single object type**: falls back to intersection `T & P` so structural matches still narrow (e.g. `{ status: "failed" }` on a `Job` with `status: JobStatus`).
- **Type-predicate guard** (`(x): x is U`): narrows to `U` via `when(predicate)`.
- **Plain boolean guard** (`(x) => boolean`): leaves the handler input as `T`.

`Pattern<T>` admits object-shaped patterns only when `T extends object`. Primitive `T` (`number | string`) accepts literals and guards but not free-form objects — this prevents `Record<string, unknown>` distributing into `Narrow` and polluting the handler input type.

## Result-type seeding

`match(x).returnType<R>()` returns a `LockedMatchBuilder<T, R, …>` whose `.with()` handlers must return `R`. Use when branch return-type inference widens to a union narrower than the slot the match feeds into (`ReactNode`, an API DTO, etc.).

## Type tests

`test/types.spec.ts` uses `ts-expect` (`expectType` + `TypeEqual`) — same approach as styled-cva.

## Non-goals (v1)

- Deep/spread patterns, `P.select`, `P.not`, nested unwrapping
- Compile-time proof of exhaustiveness (use `assertNever` + discipline; runtime throw on miss)
- Replacing `if` for two-branch checks or nullable guards

## Exports

| Subpath | Purpose |
|---------|---------|
| `@onrails/pattern` | `match`, `when`, `assertNever`, `MatchBuilder`, `LockedMatchBuilder`, `Pattern`, `Narrow`, `NarrowUnion` |
| `@onrails/pattern/tag` | `matchTag` for `_tag` dispatch |

## Migration from ts-pattern

| ts-pattern | @onrails/pattern |
|------------|------------------|
| `match(x).with({ type: "a" }, fn).exhaustive()` | Same |
| `match(x).with("a", fn).exhaustive()` | Same (primitive / literal union) |
| `match(x).with(p1, p2, fn)` (multi-pattern) | `.withOneOf([p1, p2], fn)` or `.withEither(p1, p2, fn)` |
| `P.when(fn)` | `when(fn)` (preserves type-predicate narrowing) |
| `match(x).returnType<R>()` | Same |
| `P._` / nested selects | Not v1 — keep ts-pattern or refactor to `matchTag` |

## Multi-pattern

`.withOneOf([p1, p2, …], handler)` registers one case whose test ORs the patterns. Handler input is `NarrowUnion<T, Ps>` (union of per-pattern narrowings). `.withEither(p1, p2, handler)` is sugar for two patterns.

## Deferred

- Variadic `.with(p1, p2, fn)` overload (ts-pattern arity style)
- `compat/ts-pattern` re-export or codemod
