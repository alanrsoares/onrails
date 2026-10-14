# Changelog

## [0.5.0](https://github.com/alanrsoares/onrails/compare/result-v0.4.2...result-v0.5.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **result:** Result and Maybe carriers are now objects with methods on a non-enumerable prototype. ok(), err(), some() and none() return them; the _tag / value / error fields are unchanged and JSON.stringify output is the same. Hand-written { _tag: "Ok", value }, { _tag: "Err", error }, { _tag: "Some", value } and { _tag: "None" } literals are no longer Result or Maybe; run onrails-codemod --literals to rewrite them to ok() / err() / some() / none(). Data that went through JSON.parse, structuredClone, postMessage, spread or a Redux / IndexedDB round-trip has lost its methods; lift it with Result.from(data) or Maybe.from(data). Result methods follow core semantics: tap does not swallow throws and recover keeps the Ok type. The carrier-sinks-need-from lint rule (ESLint and Biome) flags JSON.parse, structuredClone and .json() output typed as Result / Maybe without from(); the Biome rule only matches the as cast form.

### Features

* **biome-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **codemod:** rewrite carrier literals to constructors ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **eslint-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **result:** prototype carriers, neverthrow parity ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))


### Bug Fixes

* **result:** render Ok/Err in inspect output ([#105](https://github.com/alanrsoares/onrails/issues/105)) ([fbdde0a](https://github.com/alanrsoares/onrails/commit/fbdde0a40b6eb87a318635e3f3a47c6614ebf08a))
* **result:** throw on unknown tag in from ([#102](https://github.com/alanrsoares/onrails/issues/102)) ([47c0416](https://github.com/alanrsoares/onrails/commit/47c04160d20018223eb116032c51dba1ea38ff08))


### Performance Improvements

* **pattern:** compile match tests; linearize builder ([#103](https://github.com/alanrsoares/onrails/issues/103)) ([a2fd26f](https://github.com/alanrsoares/onrails/commit/a2fd26f3fa56925988a8d98504ef0606d5a3246d))

## [0.4.2](https://github.com/alanrsoares/onrails/compare/result-v0.4.1...result-v0.4.2) (2026-09-24)


### Bug Fixes

* **result:** pass generic T through ok/err ([#95](https://github.com/alanrsoares/onrails/issues/95)) ([83043ed](https://github.com/alanrsoares/onrails/commit/83043ed5c0b7a304b0256419ba6d75f8d3d2fb3e))

## [0.4.1](https://github.com/alanrsoares/onrails/compare/result-v0.4.0...result-v0.4.1) (2026-09-06)


### Features

* **result:** lock literals in ok/err and name one default path ([#92](https://github.com/alanrsoares/onrails/issues/92)) ([8437db6](https://github.com/alanrsoares/onrails/commit/8437db6e20abad23632f55cf64ef7dca1ca4579d))

## [0.4.0](https://github.com/alanrsoares/onrails/compare/result-v0.3.1...result-v0.4.0) (2026-07-04)


### ⚠ BREAKING CHANGES

* **result:** remove fluentAsync ([#84](https://github.com/alanrsoares/onrails/issues/84))

### Features

* **result:** remove fluentAsync ([#84](https://github.com/alanrsoares/onrails/issues/84)) ([1f5e564](https://github.com/alanrsoares/onrails/commit/1f5e5641f20844fda9d3bb8eaca364a230ef1e15))

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
