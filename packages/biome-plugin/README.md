# @onrails/biome-plugin

Biome GritQL rules for `@onrails/result` boundaries — mirrors `@onrails/eslint-plugin` for projects that lint with Biome.

## Install

```bash
bun add -d @onrails/biome-plugin @biomejs/biome
```

## Use

Reference the rule files in `biome.json` plugins:

```jsonc
{
  "plugins": [
    "./node_modules/@onrails/biome-plugin/rules/no-promise-result.grit",
    "./node_modules/@onrails/biome-plugin/rules/no-unsafe-unwrap.grit",
    "./node_modules/@onrails/biome-plugin/rules/no-deprecated-synonyms.grit",
    "./node_modules/@onrails/biome-plugin/rules/fluent-stays-local.grit"
  ]
}
```

## Rules

| Rule | What it catches |
|------|------------------|
| `no-promise-result` | `Promise<Result<T, E>>` in any type position — return `ResultAsync<T, E>` and use `fromAsync` / `tryAsync` at the boundary (error) |
| `no-unsafe-unwrap`  | `._unsafeUnwrap()` / `._unsafeUnwrapErr()` calls — use `match` / `resolve` / `yieldResult` instead (error) |
| `no-deprecated-synonyms` | Deprecated synonyms (`chain`, `fold`, `getOrElse`, `of`, …) — use the canonical names (error, partly fixable) |
| `fluent-stays-local` | Bare `FluentResult<…>` / `FluentMaybe<…>` type references — broader net than the ESLint rule, see `ENGINE_DIVERGENCES` (error) |

## Fixes

`no-deprecated-synonyms` rewrites. `.chain()` → `.flatMap()` is a **safe** fix, applied by `biome check --write`. The free-function renames (`matchResult`/`matchMaybe` → `match`, `getOrElse` → `unwrapOr`, `collect` → `combine`, `sequenceTupleAsync` → `ResultAsync.combineTuple`) are **unsafe** — the canonical name still has to be imported, which GritQL cannot do — so they need `biome check --write --unsafe` plus an import fix, or `@onrails/codemod`, which rewrites the imports too. `fold`, `of`, and `ResultAsync.isOk()` / `.isErr()` have no mechanical rewrite and stay diagnostic-only.

## Scoping

`no-deprecated-synonyms` only fires in files that mention an `@onrails/*` module source, so RxJS `of` or fp-ts `fold` in unrelated files are left alone. Files that reach onrails through a local alias or re-export are not matched — use the ESLint plugin, which matches by name everywhere. Declared as `no-deprecated-synonyms` / `import-scoped` in `ENGINE_DIVERGENCES`.

Requires Biome >= 2.5.12 for plugin rewrites and `fix_kind`.

## Tests

Fixtures under `test/fixtures/{valid,invalid}/` (isolated `biome.json` with `root: true`). Tests in `test/rules.spec.ts` shell out to `biome lint --reporter=json` from that directory and assert message substrings.
