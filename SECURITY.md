# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub's **Security advisories** flow:

<https://github.com/alanrsoares/onrails/security/advisories/new>

You'll get an acknowledgement within a few days. Please **do not** open a public issue for security reports until a fix has been released.

## Supported versions

Only the latest minor release of each `@onrails/*` package is supported. Pre-`1.0.0` releases may receive fixes via the next minor bump.

## Scope

In scope: vulnerabilities in code published under `@onrails/*` on npm, the codemod CLI, and the GitHub Actions workflows in this repository.

Out of scope: vulnerabilities in transitive dependencies (please report upstream), and issues in code that imports `@onrails/result/compat/neverthrow` but uses APIs forbidden by the docs (e.g. `_unsafeUnwrap` in production paths).
