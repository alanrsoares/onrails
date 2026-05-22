# @onrails/eslint-plugin

ESLint rules for `@onrails/result` boundaries. Replaces the unmaintained `eslint-plugin-neverthrow`.

## Install

```bash
bun add -d @onrails/eslint-plugin
```

## Flat config (ESLint 9+)

```js
// eslint.config.js
import onrails from "@onrails/eslint-plugin";

export default [
  {
    plugins: { "@onrails": onrails },
    rules: {
      "@onrails/no-promise-result": "warn",
      "@onrails/no-unsafe-unwrap": "warn",
    },
  },
];
```

Or use the recommended preset:

```js
import onrails from "@onrails/eslint-plugin";

export default [
  {
    plugins: { "@onrails": onrails },
    rules: {
      ...onrails.configs.recommended.rules,
    },
  },
];
```

## Rules

| Rule | What it does |
|---|---|
| `@onrails/no-promise-result` | Flags `Promise<Result<…>>` in source — public APIs should return `ResultAsync` |
| `@onrails/no-unsafe-unwrap` | Flags `_unsafeUnwrap*` outside test files |

## Caveats (v0)

- Current rules are **text-scan only**. They catch the common cases but miss `Promise<Result<…>>` hidden inside complex generics. A `@typescript-eslint`-powered AST rule is planned.
- Spec files (`*.spec.ts`) are exempted from `no-unsafe-unwrap`.

## License

MIT
