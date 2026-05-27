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
    "./node_modules/@onrails/biome-plugin/rules/no-unsafe-unwrap.grit"
  ]
}
```

## Rules

| Rule | What it catches |
|------|------------------|
| `no-promise-result` | `Promise<Result<T, E>>` in any type position — return `ResultAsync<T, E>` and use `fromAsync` / `tryAsync` at the boundary |
| `no-unsafe-unwrap`  | `._unsafeUnwrap()` / `._unsafeUnwrapErr()` calls — use `match` / `resolve` / `yieldResult` instead |

## Tests

Fixtures under `fixtures/{valid,invalid}/`. Tests in `src/rules.spec.ts` shell out to `biome lint --reporter=json` and assert message substrings.
