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

Rewrites every `from "neverthrow"` import and every `neverthrow` `package.json` dep to point at `@onrails/result/compat/neverthrow`.

- Walks `.ts` / `.tsx` / `.mts` / `.cts`. Skips `node_modules`, `dist`, `.git`, `.next`, `.turbo`, `coverage`, `build`.
- Rewrites only the specifier in `import` / `from` / `import(...)`; string mentions of `"neverthrow"` in regular code are left alone.
- Updates `dependencies` / `devDependencies` / `peerDependencies` in every nested `package.json` that lists `neverthrow`, replacing it with `@onrails/result` at a path relative to that `package.json`.
- Idempotent. Safe to re-run.

## Usage

```bash
# dry run
bunx @onrails/codemod /path/to/target-repo --dry

# apply
bunx @onrails/codemod /path/to/target-repo

# point at a local @onrails/result checkout (file: install)
bunx @onrails/codemod /path/to/target-repo \
  --onrails=/Users/me/dev/onrails/packages/result
```

After applying:

```bash
cd target-repo
rm -rf node_modules/.bun/@onrails* node_modules/@onrails   # force-refresh file: deps if using a local checkout
bun install
bun typecheck
bun test
```

## Roadmap

- Stage-2 codemod (compat → native `@onrails/result` API): planned, not shipped. Tracking in the repo issues.
- Generalized rename codemod (any `from "A"` → `from "B"` + deps): planned.

## License

MIT
