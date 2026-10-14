# Changelog

## [0.4.0](https://github.com/alanrsoares/onrails/compare/pattern-v0.3.5...pattern-v0.4.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **result:** Result and Maybe carriers are now objects with methods on a non-enumerable prototype. ok(), err(), some() and none() return them; the _tag / value / error fields are unchanged and JSON.stringify output is the same. Hand-written { _tag: "Ok", value }, { _tag: "Err", error }, { _tag: "Some", value } and { _tag: "None" } literals are no longer Result or Maybe; run onrails-codemod --literals to rewrite them to ok() / err() / some() / none(). Data that went through JSON.parse, structuredClone, postMessage, spread or a Redux / IndexedDB round-trip has lost its methods; lift it with Result.from(data) or Maybe.from(data). Result methods follow core semantics: tap does not swallow throws and recover keeps the Ok type. The carrier-sinks-need-from lint rule (ESLint and Biome) flags JSON.parse, structuredClone and .json() output typed as Result / Maybe without from(); the Biome rule only matches the as cast form.

### Features

* **biome-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **codemod:** rewrite carrier literals to constructors ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **eslint-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **result:** prototype carriers, neverthrow parity ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))


### Performance Improvements

* **pattern:** compile match tests; linearize builder ([#103](https://github.com/alanrsoares/onrails/issues/103)) ([a2fd26f](https://github.com/alanrsoares/onrails/commit/a2fd26f3fa56925988a8d98504ef0606d5a3246d))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.5.0

## [0.3.5](https://github.com/alanrsoares/onrails/compare/pattern-v0.3.4...pattern-v0.3.5) (2026-09-24)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.4.2

## [0.3.4](https://github.com/alanrsoares/onrails/compare/pattern-v0.3.3...pattern-v0.3.4) (2026-09-06)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.4.1

## [0.3.3](https://github.com/alanrsoares/onrails/compare/pattern-v0.3.2...pattern-v0.3.3) (2026-07-21)


### Bug Fixes

* **pattern:** tail-call match dispatch for constant-stack recursion ([3a92d3e](https://github.com/alanrsoares/onrails/commit/3a92d3eda6d0fe5e8c39fc14fe2efd428b490b33))

## [0.3.2](https://github.com/alanrsoares/onrails/compare/pattern-v0.3.1...pattern-v0.3.2) (2026-07-04)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.4.0

## [0.3.1](https://github.com/alanrsoares/onrails/compare/pattern-v0.3.0...pattern-v0.3.1) (2026-07-04)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.3.1

## [0.3.0](https://github.com/alanrsoares/onrails/compare/pattern-v0.2.0...pattern-v0.3.0) (2026-07-03)


### ⚠ BREAKING CHANGES

* **pattern:** LockedMatchBuilder is no longer exported; use MatchBuilder<T, R, HasInput, Handled, true> directly.

### Features

* **pattern:** remove LockedMatchBuilder alias ([#76](https://github.com/alanrsoares/onrails/issues/76)) ([64f4fde](https://github.com/alanrsoares/onrails/commit/64f4fde9da9b762b80483c26a51af6460decd8cf))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.3.0

## [0.2.0](https://github.com/alanrsoares/onrails/compare/pattern-v0.1.4...pattern-v0.2.0) (2026-06-18)


### ⚠ BREAKING CHANGES

* removed deprecated aliases and the @onrails/result/mcp subpath. Migrate to canonical names with onrails-codemod-neverthrow.

### Code Refactoring

* API coherence — remove deprecated alias tier (RFC 0001) ([#36](https://github.com/alanrsoares/onrails/issues/36)) ([7b9f157](https://github.com/alanrsoares/onrails/commit/7b9f157cedebf1a1904a46005cee96bb98bfe296))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.2.0

## [0.1.4](https://github.com/alanrsoares/onrails/compare/pattern-v0.1.3...pattern-v0.1.4) (2026-06-13)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.4

## [0.1.3](https://github.com/alanrsoares/onrails/compare/pattern-v0.1.2...pattern-v0.1.3) (2026-06-13)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.3

## [0.1.2](https://github.com/alanrsoares/onrails/compare/pattern-v0.1.1...pattern-v0.1.2) (2026-06-11)


### Bug Fixes

* **repo:** quality review fixes and cleanup ([#14](https://github.com/alanrsoares/onrails/issues/14)) ([29a606a](https://github.com/alanrsoares/onrails/commit/29a606a5ab8eb668b9fbcde282838d4cfd73b33f))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.2

## [0.1.1](https://github.com/alanrsoares/onrails/compare/pattern-v0.1.0...pattern-v0.1.1) (2026-06-02)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.1

## 0.1.0 (2026-05-28)


### Features

* dual-form API, variadic pipe, point-free recipes, biome plugin ([f9670e7](https://github.com/alanrsoares/onrails/commit/f9670e71daa644424445460105dcf62be66982e8))
* **pattern:** add exhaustive matching for owned unions ([df97497](https://github.com/alanrsoares/onrails/commit/df974976c92a5626f2b780f376cb2ff9982d9243))
* **pattern:** add withOneOf and withEither ([fde9840](https://github.com/alanrsoares/onrails/commit/fde9840e1312fb644e25dd093033c59655e70a44))
* **pattern:** compile time exhaustive pattern matching ([834bb24](https://github.com/alanrsoares/onrails/commit/834bb24bf4a4f741931e0f0ed429b9ab3ce3d609))
* **pattern:** returnType seeding, type-predicate when, intersection-narrow ([8234e0f](https://github.com/alanrsoares/onrails/commit/8234e0fce68b3a60221836ebbea6426634ae4035))


### Bug Fixes

* **pattern:** distinguish 'no match' from handler returning undefined ([00571c7](https://github.com/alanrsoares/onrails/commit/00571c71df2b8375c9654ef38b0f119a5c7ad528))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.0
