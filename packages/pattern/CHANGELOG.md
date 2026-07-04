# Changelog

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
