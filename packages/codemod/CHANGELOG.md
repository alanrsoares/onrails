# Changelog

## [0.3.0](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.8...codemod-v0.3.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **result:** Result and Maybe carriers are now objects with methods on a non-enumerable prototype. ok(), err(), some() and none() return them; the _tag / value / error fields are unchanged and JSON.stringify output is the same. Hand-written { _tag: "Ok", value }, { _tag: "Err", error }, { _tag: "Some", value } and { _tag: "None" } literals are no longer Result or Maybe; run onrails-codemod --literals to rewrite them to ok() / err() / some() / none(). Data that went through JSON.parse, structuredClone, postMessage, spread or a Redux / IndexedDB round-trip has lost its methods; lift it with Result.from(data) or Maybe.from(data). Result methods follow core semantics: tap does not swallow throws and recover keeps the Ok type. The carrier-sinks-need-from lint rule (ESLint and Biome) flags JSON.parse, structuredClone and .json() output typed as Result / Maybe without from(); the Biome rule only matches the as cast form.

### Features

* **biome-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **codemod:** rewrite carrier literals to constructors ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **eslint-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **result:** prototype carriers, neverthrow parity ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))


### Bug Fixes

* **eslint-plugin:** follow carrier sinks through flow ([#106](https://github.com/alanrsoares/onrails/issues/106)) ([ee9d171](https://github.com/alanrsoares/onrails/commit/ee9d17198f9944fb1f5904d0f009e169d0deaf18))
* **result:** throw on unknown tag in from ([#102](https://github.com/alanrsoares/onrails/issues/102)) ([47c0416](https://github.com/alanrsoares/onrails/commit/47c04160d20018223eb116032c51dba1ea38ff08))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.3.0
    * @onrails/pattern bumped to 0.4.0
    * @onrails/result bumped to 0.5.0

## [0.2.8](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.7...codemod-v0.2.8) (2026-09-24)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.2.5
    * @onrails/pattern bumped to 0.3.5
    * @onrails/result bumped to 0.4.2

## [0.2.7](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.6...codemod-v0.2.7) (2026-09-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.2.4
    * @onrails/pattern bumped to 0.3.4
    * @onrails/result bumped to 0.4.1

## [0.2.6](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.5...codemod-v0.2.6) (2026-09-04)


### Features

* **biome-plugin:** import-scope and autofix deprecated synonyms ([#90](https://github.com/alanrsoares/onrails/issues/90)) ([a50700c](https://github.com/alanrsoares/onrails/commit/a50700cea63785172165a6204c07750e6bb84ddc))

## [0.2.5](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.4...codemod-v0.2.5) (2026-07-21)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.3

## [0.2.4](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.3...codemod-v0.2.4) (2026-07-04)


### Features

* **codemod:** fluent-stays-local rule across engines ([#86](https://github.com/alanrsoares/onrails/issues/86)) ([f7b1f5d](https://github.com/alanrsoares/onrails/commit/f7b1f5dcb9cd82a4a4df713304168292c13ab649))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.2.3
    * @onrails/pattern bumped to 0.3.2
    * @onrails/result bumped to 0.4.0

## [0.2.3](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.2...codemod-v0.2.3) (2026-07-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.2.2
    * @onrails/pattern bumped to 0.3.1
    * @onrails/result bumped to 0.3.1

## [0.2.2](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.1...codemod-v0.2.2) (2026-07-03)


### Features

* **codemod:** boundary spec owns enforced idiom names ([#78](https://github.com/alanrsoares/onrails/issues/78)) ([b00335e](https://github.com/alanrsoares/onrails/commit/b00335ec37248843b37bdcc45cb2cd74313b5d7a))


### Bug Fixes

* **codemod:** unwrap single-child JSX fragment ([#74](https://github.com/alanrsoares/onrails/issues/74)) ([0217862](https://github.com/alanrsoares/onrails/commit/021786294d2df26f0186250f77ed95380ef4e287))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.2.1
    * @onrails/pattern bumped to 0.3.0
    * @onrails/result bumped to 0.3.0

## [0.2.1](https://github.com/alanrsoares/onrails/compare/codemod-v0.2.0...codemod-v0.2.1) (2026-06-18)


### Bug Fixes

* **codemod:** parse JSX files in TSX mode ([#39](https://github.com/alanrsoares/onrails/issues/39)) ([79af554](https://github.com/alanrsoares/onrails/commit/79af5546471d68bf9153a3fab4bbbec518c0442b))

## [0.2.0](https://github.com/alanrsoares/onrails/compare/codemod-v0.1.4...codemod-v0.2.0) (2026-06-18)


### ⚠ BREAKING CHANGES

* removed deprecated aliases and the @onrails/result/mcp subpath. Migrate to canonical names with onrails-codemod-neverthrow.

### Features

* **codemod:** add tersify AST refactoring mode ([#31](https://github.com/alanrsoares/onrails/issues/31)) ([fa37f14](https://github.com/alanrsoares/onrails/commit/fa37f1410dd63f958a650630acdf4b707d88393b))
* **codemod:** expand tersify refactoring rules ([#32](https://github.com/alanrsoares/onrails/issues/32)) ([1cb7656](https://github.com/alanrsoares/onrails/commit/1cb765644f56cccfcd31b367cc48456bb8a6a4c9))


### Code Refactoring

* API coherence — remove deprecated alias tier (RFC 0001) ([#36](https://github.com/alanrsoares/onrails/issues/36)) ([7b9f157](https://github.com/alanrsoares/onrails/commit/7b9f157cedebf1a1904a46005cee96bb98bfe296))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.2.0
    * @onrails/pattern bumped to 0.2.0
    * @onrails/result bumped to 0.2.0

## [0.1.4](https://github.com/alanrsoares/onrails/compare/codemod-v0.1.3...codemod-v0.1.4) (2026-06-13)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.1.4
    * @onrails/pattern bumped to 0.1.4
    * @onrails/result bumped to 0.1.4

## [0.1.3](https://github.com/alanrsoares/onrails/compare/codemod-v0.1.2...codemod-v0.1.3) (2026-06-13)


### Features

* **api:** api coherence ([#21](https://github.com/alanrsoares/onrails/issues/21)) ([9150057](https://github.com/alanrsoares/onrails/commit/915005747d25e049bc45f3bf6ffc944b274501ac))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.1.3
    * @onrails/pattern bumped to 0.1.3
    * @onrails/result bumped to 0.1.3

## [0.1.2](https://github.com/alanrsoares/onrails/compare/codemod-v0.1.1...codemod-v0.1.2) (2026-06-11)


### Bug Fixes

* **repo:** quality review fixes and cleanup ([#14](https://github.com/alanrsoares/onrails/issues/14)) ([29a606a](https://github.com/alanrsoares/onrails/commit/29a606a5ab8eb668b9fbcde282838d4cfd73b33f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.1.2
    * @onrails/pattern bumped to 0.1.2
    * @onrails/result bumped to 0.1.2

## [0.1.1](https://github.com/alanrsoares/onrails/compare/codemod-v0.1.0...codemod-v0.1.1) (2026-06-02)


### Features

* **codemod:** improved codemod confidence and test coverage ([6c0c2e9](https://github.com/alanrsoares/onrails/commit/6c0c2e9c9b26a8289ea85c88bdfde29bf459bb12))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/maybe bumped to 0.1.1
    * @onrails/result bumped to 0.1.1

## 0.1.0 (2026-05-28)


### Bug Fixes

* **codemod:** address lint error ([ddcf368](https://github.com/alanrsoares/onrails/commit/ddcf36881050c8e62967306107d67d5837c61c2d))
