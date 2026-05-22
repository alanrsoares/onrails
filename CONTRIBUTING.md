# Contributing to onrails

Thanks for your interest. The repo is small; the rules are simple.

## Toolchain

- **Bun ≥ 1.0** is required (`bun install`, `bun test`, `bun run`).
- All packages publish as **ESM-only**, ship `.ts` sources, target **Node ≥ 18** / **Bun ≥ 1.0** consumers.
- **Biome** handles lint + format. Run `bun run lint:fix` before pushing.

## Setup

```bash
bun install
bun run check   # typecheck + lint + tests
```

`bun install` installs Husky hooks via the `prepare` script. The `pre-commit` hook runs lint+typecheck; `commit-msg` enforces [Conventional Commits](https://www.conventionalcommits.org).

## Commit format

Conventional Commits with a **scope** matching the package or area:

```
feat(result): widen andThen to accept Result | ResultAsync returns
fix(codemod): handle dynamic import() expressions
docs(repo): add SECURITY.md
chore(ci): bump setup-bun to v2
```

Valid scopes: `result`, `codemod`, `eslint-plugin`, `repo`, `deps`, `ci`, `docs`. See [`commitlint.config.cjs`](./commitlint.config.cjs).

## Releases

Releases are automated by [release-please](https://github.com/googleapis/release-please-action). When `main` receives a feat/fix commit for a package, release-please opens a release PR for that package. Merging the PR creates the GitHub release and triggers `bun publish` with npm provenance.

## Pull requests

- One package per PR, ideally.
- Add or update tests for behavior changes; `@onrails/result` has `bun:test` specs under `packages/result/test/`.
- For shim/compat changes, add or extend a case in `packages/result/test/neverthrow-conformance.spec.ts`.

## Discussion

Open an issue before large API changes. The published surface is small; please don't add new exports without a discussion.
