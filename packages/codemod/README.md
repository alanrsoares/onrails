# @onrails/codemod

Bun-based codemods for migrating onto `@onrails/result`.

## Install

```bash
bun add -d @onrails/codemod
```

Or run without installing:

```bash
bunx @onrails/codemod /path/to/target-repo --dry
```

## What it does

By default, rewrites every `from "neverthrow"` import and every `neverthrow`
`package.json` dep to point at `@onrails/result/compat/neverthrow`.

- Walks `.ts` / `.tsx` / `.mts` / `.cts`. Skips `node_modules`, `dist`, `.git`, `.next`, `.turbo`, `coverage`, `build`.
- Rewrites only the specifier in `import` / `from` / `import(...)`; string mentions of `"neverthrow"` in regular code are left alone.
- Updates `dependencies` / `devDependencies` / `peerDependencies` in every nested `package.json` that lists `neverthrow`, replacing it with `@onrails/result` at a path relative to that `package.json`.
- Idempotent. Safe to re-run.

With `--to-native`, rewrites safe `@onrails/result/compat/neverthrow`
imports to native `@onrails/result` imports, then rewrites supported sync
method chains to native `pipe(...)` calls. This mode also reports TODO lines
for compat-only properties and unsupported import shapes that still need manual
migration.

## Usage

```bash
# dry run
bunx @onrails/codemod /path/to/target-repo --dry

# apply
bunx @onrails/codemod /path/to/target-repo

# point at a local @onrails/result checkout (file: install)
bunx @onrails/codemod /path/to/target-repo \
  --onrails=/Users/me/dev/onrails/packages/result

# stage 2: compat shim -> native imports
bunx @onrails/codemod /path/to/target-repo --to-native --dry
bunx @onrails/codemod /path/to/target-repo --to-native

# optional: build carriers with constructors instead of object literals
bunx @onrails/codemod /path/to/target-repo --literals --dry
```

After applying:

```bash
cd target-repo
rm -rf node_modules/.bun/@onrails* node_modules/@onrails   # force-refresh file: deps if using a local checkout
bun install
bun typecheck
bun test
```

## Literal rewrite

`--literals` rewrites hand-built carrier literals to constructor calls, so the
code keeps working if carriers ever stop being plain objects:

| Before | After |
|---|---|
| `{ _tag: "Ok", value: x }` | `ok(x)` |
| `{ _tag: "Err", error: e }` | `err(e)` |
| `{ _tag: "Some", value: x }` | `some(x)` (`@onrails/maybe`) |
| `{ _tag: "None" }` | `none()` (`@onrails/maybe`) |

Only exact shapes are touched. Literals with extra keys, spreads, computed keys
or a non-literal `_tag` are left alone, as are files that already bind `ok`,
`err`, `some` or `none` to something else. A trailing `as const` is dropped
with the literal. Imports are added or merged. It works against the current
API, so it can run before any breaking release.

## Native migration

`--to-native` is intentionally conservative. It rewrites imports that have a
native equivalent:

```ts
import { ok, err, Result } from "@onrails/result/compat/neverthrow";
```

becomes:

```ts
import { ok, err } from "@onrails/result";
import type { Result } from "@onrails/result";
```

It does not rewrite arbitrary method chains or namespace/re-export shapes yet.
The CLI rewrites supported sync chains such as:

```ts
ok(1).map(double).andThen(validate).orElse(recoverInput);
```

to:

```ts
pipe(ok(1), map(double), flatMap(validate), recover(recoverInput));
```

Terminal `.match(...)` and `.unwrapOr(...)` become data-first native calls.
`ResultAsync`-looking chains stay method-style because the native async API
already supports those methods. The CLI still reports TODO lines for compat-only
surface such as `.isOk()`, `.value`, `Result.fromThrowable(...)`,
`import * as neverthrow from ...`, and `export { ok } from ...`.

## Roadmap

- Generalized rename codemod (any `from "A"` → `from "B"` + deps): planned.
- AST-backed compat method-chain rewrite to `pipe(...)` / `fluent(...)`: planned.

## License

MIT
