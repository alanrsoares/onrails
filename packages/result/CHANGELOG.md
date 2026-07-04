# Changelog

## [0.3.1](https://github.com/alanrsoares/onrails/compare/result-v0.3.0...result-v0.3.1) (2026-07-04)


### Features

* **result:** add of, show, and fluent exit terminals ([#81](https://github.com/alanrsoares/onrails/issues/81)) ([3d6bffb](https://github.com/alanrsoares/onrails/commit/3d6bffbd6f2eb0041a53f854f213f5ccf63cb867))

## [0.3.0](https://github.com/alanrsoares/onrails/compare/result-v0.2.0...result-v0.3.0) (2026-07-03)


### ⚠ BREAKING CHANGES

* **result:** removed parallelTupleAsync (use ResultAsync.combineTupleParallel), validateAllArray/validateTupleArray (use validateAll/validateTuple), railway() and all *Named step factories (use the Railway class builder), subpaths /$ /interop /validation (import from the package index), compat-shape returns from core flatMap/andThen callbacks, and Ok<Result> auto-flattening in fromResultPromise/fromAsync.

### Features

* **result:** add dual-form unwrapOr and unwrap ([f923a3a](https://github.com/alanrsoares/onrails/commit/f923a3ad003aba470f3d6d29b37d29ae10a9e6e0))
* **result:** one name per op across surfaces ([#79](https://github.com/alanrsoares/onrails/issues/79)) ([bf224d2](https://github.com/alanrsoares/onrails/commit/bf224d2a47e2c199a904c24113612a3b648f842c))

## [0.2.0](https://github.com/alanrsoares/onrails/compare/result-v0.1.4...result-v0.2.0) (2026-06-18)


### ⚠ BREAKING CHANGES

* removed deprecated aliases and the @onrails/result/mcp subpath. Migrate to canonical names with onrails-codemod-neverthrow.

### Features

* **repo:** adopt @tanstack/intent for skill distribution ([#29](https://github.com/alanrsoares/onrails/issues/29)) ([b9a7bb4](https://github.com/alanrsoares/onrails/commit/b9a7bb4e7b580c8c52f1536a06607cf3d84355a5))


### Code Refactoring

* API coherence — remove deprecated alias tier (RFC 0001) ([#36](https://github.com/alanrsoares/onrails/issues/36)) ([7b9f157](https://github.com/alanrsoares/onrails/commit/7b9f157cedebf1a1904a46005cee96bb98bfe296))

## [0.1.4](https://github.com/alanrsoares/onrails/compare/result-v0.1.3...result-v0.1.4) (2026-06-13)


### Features

* **result:** dual-form asyncAfter, parseNamed, $ barrel ([#26](https://github.com/alanrsoares/onrails/issues/26)) ([bbf9fa0](https://github.com/alanrsoares/onrails/commit/bbf9fa00ce86f1b243bde536f565edbc2f0cb312))

## [0.1.3](https://github.com/alanrsoares/onrails/compare/result-v0.1.2...result-v0.1.3) (2026-06-13)


### Features

* **api:** api coherence ([#21](https://github.com/alanrsoares/onrails/issues/21)) ([9150057](https://github.com/alanrsoares/onrails/commit/915005747d25e049bc45f3bf6ffc944b274501ac))

## [0.1.2](https://github.com/alanrsoares/onrails/compare/result-v0.1.1...result-v0.1.2) (2026-06-11)


### Bug Fixes

* **repo:** quality review fixes and cleanup ([#14](https://github.com/alanrsoares/onrails/issues/14)) ([29a606a](https://github.com/alanrsoares/onrails/commit/29a606a5ab8eb668b9fbcde282838d4cfd73b33f))

## [0.1.1](https://github.com/alanrsoares/onrails/compare/result-v0.1.0...result-v0.1.1) (2026-06-02)


### Features

* **codemod:** improved codemod confidence and test coverage ([6c0c2e9](https://github.com/alanrsoares/onrails/commit/6c0c2e9c9b26a8289ea85c88bdfde29bf459bb12))

## 0.1.0 (2026-05-28)


### Features

* dual-form API, variadic pipe, point-free recipes, biome plugin ([f9670e7](https://github.com/alanrsoares/onrails/commit/f9670e71daa644424445460105dcf62be66982e8))
* **result:** add point-free recipes + validation tests ([56a44ed](https://github.com/alanrsoares/onrails/commit/56a44ed8d70638e3209690bb66c39138f04dfc81))
* **result:** add railway workflows ([aadb886](https://github.com/alanrsoares/onrails/commit/aadb8864b89c27bd15f239144c363c33131d3074))
* **result:** dual-form ops, variadic pipe, recipes ([a200e2d](https://github.com/alanrsoares/onrails/commit/a200e2d7aecba1a12f21c4882070ff2c13963fdf))
* **result:** run Railway.parallel branches concurrently ([d8e9320](https://github.com/alanrsoares/onrails/commit/d8e93208e05ee16956de70adcb6387ec75ec8499))


### Bug Fixes

* **result:** correct distributive inference in type extractors ([52e8671](https://github.com/alanrsoares/onrails/commit/52e86713c08d033faa27f6bc1c306b18e851289e))
