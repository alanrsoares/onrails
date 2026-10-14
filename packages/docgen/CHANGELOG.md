# Changelog

## [2.0.0](https://github.com/alanrsoares/onrails/compare/docgen-v1.1.5...docgen-v2.0.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **result:** Result and Maybe carriers are now objects with methods on a non-enumerable prototype. ok(), err(), some() and none() return them; the _tag / value / error fields are unchanged and JSON.stringify output is the same. Hand-written { _tag: "Ok", value }, { _tag: "Err", error }, { _tag: "Some", value } and { _tag: "None" } literals are no longer Result or Maybe; run onrails-codemod --literals to rewrite them to ok() / err() / some() / none(). Data that went through JSON.parse, structuredClone, postMessage, spread or a Redux / IndexedDB round-trip has lost its methods; lift it with Result.from(data) or Maybe.from(data). Result methods follow core semantics: tap does not swallow throws and recover keeps the Ok type. The carrier-sinks-need-from lint rule (ESLint and Biome) flags JSON.parse, structuredClone and .json() output typed as Result / Maybe without from(); the Biome rule only matches the as cast form.

### Features

* **biome-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **codemod:** rewrite carrier literals to constructors ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **eslint-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **maybe:** widen unwrapOr default to T | U ([#108](https://github.com/alanrsoares/onrails/issues/108)) ([aad6cb9](https://github.com/alanrsoares/onrails/commit/aad6cb90cc505bee2a075f4e88f20648de6737f4))
* **result:** prototype carriers, neverthrow parity ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.4.0
    * @onrails/result bumped to 0.5.0

## [1.1.5](https://github.com/alanrsoares/onrails/compare/docgen-v1.1.4...docgen-v1.1.5) (2026-09-24)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.5
    * @onrails/result bumped to 0.4.2

## [1.1.4](https://github.com/alanrsoares/onrails/compare/docgen-v1.1.3...docgen-v1.1.4) (2026-09-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.4
    * @onrails/result bumped to 0.4.1

## [1.1.3](https://github.com/alanrsoares/onrails/compare/docgen-v1.1.2...docgen-v1.1.3) (2026-07-21)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.3

## [1.1.2](https://github.com/alanrsoares/onrails/compare/docgen-v1.1.1...docgen-v1.1.2) (2026-07-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.2
    * @onrails/result bumped to 0.4.0

## [1.1.1](https://github.com/alanrsoares/onrails/compare/docgen-v1.1.0...docgen-v1.1.1) (2026-07-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.1
    * @onrails/result bumped to 0.3.1

## [1.1.0](https://github.com/alanrsoares/onrails/compare/docgen-v1.0.1...docgen-v1.1.0) (2026-07-03)


### Features

* **docgen:** add in-memory compiler host seam ([9b3946c](https://github.com/alanrsoares/onrails/commit/9b3946c028c20eb71db5641f7b731c75681eca5b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @onrails/pattern bumped to 0.3.0
    * @onrails/result bumped to 0.3.0

## [1.0.1](https://github.com/alanrsoares/onrails/compare/docgen-v1.0.0...docgen-v1.0.1) (2026-06-22)


### Bug Fixes

* **docgen:** publish caret ranges for workspace deps ([#69](https://github.com/alanrsoares/onrails/issues/69)) ([7150297](https://github.com/alanrsoares/onrails/commit/715029765b660282e7d10abe84bf4ed43a978612))

## 1.0.0 (2026-06-22)


### Features

* **docgen:** publish API-reference generator ([#66](https://github.com/alanrsoares/onrails/issues/66)) ([7c11f11](https://github.com/alanrsoares/onrails/commit/7c11f117d420b527e64d6d5f35b095460cc502fd))
* **docs:** add @onrails/docgen package ([#42](https://github.com/alanrsoares/onrails/issues/42)) ([e291266](https://github.com/alanrsoares/onrails/commit/e2912668c19a4712390b691dc29fec7a60e88ad7))
* **repo:** add @onrails/twoslash package ([#44](https://github.com/alanrsoares/onrails/issues/44)) ([c643b3e](https://github.com/alanrsoares/onrails/commit/c643b3e603aa682e26eba85ca52dbf60264841cb))


### Bug Fixes

* **docs:** resolve correct anchor slugs with badge suffixes ([#62](https://github.com/alanrsoares/onrails/issues/62)) ([546741c](https://github.com/alanrsoares/onrails/commit/546741c1144487176f258090384f8366f6b12461))
