# Changelog

## [0.3.0](https://github.com/alanrsoares/onrails/compare/maybe-v0.2.5...maybe-v0.3.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **result:** Result and Maybe carriers are now objects with methods on a non-enumerable prototype. ok(), err(), some() and none() return them; the _tag / value / error fields are unchanged and JSON.stringify output is the same. Hand-written { _tag: "Ok", value }, { _tag: "Err", error }, { _tag: "Some", value } and { _tag: "None" } literals are no longer Result or Maybe; run onrails-codemod --literals to rewrite them to ok() / err() / some() / none(). Data that went through JSON.parse, structuredClone, postMessage, spread or a Redux / IndexedDB round-trip has lost its methods; lift it with Result.from(data) or Maybe.from(data). Result methods follow core semantics: tap does not swallow throws and recover keeps the Ok type. The carrier-sinks-need-from lint rule (ESLint and Biome) flags JSON.parse, structuredClone and .json() output typed as Result / Maybe without from(); the Biome rule only matches the as cast form.

### Features

* **biome-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **codemod:** rewrite carrier literals to constructors ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **eslint-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **maybe:** widen unwrapOr default to T | U ([#108](https://github.com/alanrsoares/onrails/issues/108)) ([aad6cb9](https://github.com/alanrsoares/onrails/commit/aad6cb90cc505bee2a075f4e88f20648de6737f4))
* **result:** prototype carriers, neverthrow parity ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))


### Bug Fixes

* **result:** render Ok/Err in inspect output ([#105](https://github.com/alanrsoares/onrails/issues/105)) ([fbdde0a](https://github.com/alanrsoares/onrails/commit/fbdde0a40b6eb87a318635e3f3a47c6614ebf08a))
* **result:** throw on unknown tag in from ([#102](https://github.com/alanrsoares/onrails/issues/102)) ([47c0416](https://github.com/alanrsoares/onrails/commit/47c04160d20018223eb116032c51dba1ea38ff08))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.5.0
  * peerDependencies
    * @onrails/result bumped to 0.5.0

## [0.2.5](https://github.com/alanrsoares/onrails/compare/maybe-v0.2.4...maybe-v0.2.5) (2026-09-24)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.4.2
  * peerDependencies
    * @onrails/result bumped to 0.4.2

## [0.2.4](https://github.com/alanrsoares/onrails/compare/maybe-v0.2.3...maybe-v0.2.4) (2026-09-06)


### Features

* **result:** lock literals in ok/err and name one default path ([#92](https://github.com/alanrsoares/onrails/issues/92)) ([8437db6](https://github.com/alanrsoares/onrails/commit/8437db6e20abad23632f55cf64ef7dca1ca4579d))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.4.1
  * peerDependencies
    * @onrails/result bumped to 0.4.1

## [0.2.3](https://github.com/alanrsoares/onrails/compare/maybe-v0.2.2...maybe-v0.2.3) (2026-07-04)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.4.0
  * peerDependencies
    * @onrails/result bumped to 0.4.0

## [0.2.2](https://github.com/alanrsoares/onrails/compare/maybe-v0.2.1...maybe-v0.2.2) (2026-07-04)


### Features

* **maybe:** add of, show, fluent terminals, symmetry spec ([#83](https://github.com/alanrsoares/onrails/issues/83)) ([63e0080](https://github.com/alanrsoares/onrails/commit/63e008089a8495422e0c5f58ede9cd35c7971dbb))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.3.1
  * peerDependencies
    * @onrails/result bumped to 0.3.1

## [0.2.1](https://github.com/alanrsoares/onrails/compare/maybe-v0.2.0...maybe-v0.2.1) (2026-07-03)


### Features

* **maybe:** currying and fluent alignment ([62c12bf](https://github.com/alanrsoares/onrails/commit/62c12bf8ad1223cf5fa9441d777481f1485eb53f))
* **maybe:** own dual-form dispatch in one combinator ([#77](https://github.com/alanrsoares/onrails/issues/77)) ([eb56fab](https://github.com/alanrsoares/onrails/commit/eb56fab1b398979b1e31f756a55776bcb069cf3f))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.3.0
  * peerDependencies
    * @onrails/result bumped to 0.3.0

## [0.2.0](https://github.com/alanrsoares/onrails/compare/maybe-v0.1.4...maybe-v0.2.0) (2026-06-18)


### ⚠ BREAKING CHANGES

* removed deprecated aliases and the @onrails/result/mcp subpath. Migrate to canonical names with onrails-codemod-neverthrow.

### Code Refactoring

* API coherence — remove deprecated alias tier (RFC 0001) ([#36](https://github.com/alanrsoares/onrails/issues/36)) ([7b9f157](https://github.com/alanrsoares/onrails/commit/7b9f157cedebf1a1904a46005cee96bb98bfe296))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.2.0
  * peerDependencies
    * @onrails/result bumped to 0.2.0

## [0.1.4](https://github.com/alanrsoares/onrails/compare/maybe-v0.1.3...maybe-v0.1.4) (2026-06-13)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.4
  * peerDependencies
    * @onrails/result bumped to 0.1.4

## [0.1.3](https://github.com/alanrsoares/onrails/compare/maybe-v0.1.2...maybe-v0.1.3) (2026-06-13)


### Features

* **api:** api coherence ([#21](https://github.com/alanrsoares/onrails/issues/21)) ([9150057](https://github.com/alanrsoares/onrails/commit/915005747d25e049bc45f3bf6ffc944b274501ac))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.3
  * peerDependencies
    * @onrails/result bumped to 0.1.3

## [0.1.2](https://github.com/alanrsoares/onrails/compare/maybe-v0.1.1...maybe-v0.1.2) (2026-06-11)


### Features

* **maybe:** add tap and tapNone ([#10](https://github.com/alanrsoares/onrails/issues/10)) ([b75aeea](https://github.com/alanrsoares/onrails/commit/b75aeead0b879a5424d1d4b9939480ea074852b2))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.2
  * peerDependencies
    * @onrails/result bumped to 0.1.2

## [0.1.1](https://github.com/alanrsoares/onrails/compare/maybe-v0.1.0...maybe-v0.1.1) (2026-06-02)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.1
  * peerDependencies
    * @onrails/result bumped to 0.1.1

## 0.1.0 (2026-05-28)


### Features

* dual-form API, variadic pipe, point-free recipes, biome plugin ([f9670e7](https://github.com/alanrsoares/onrails/commit/f9670e71daa644424445460105dcf62be66982e8))
* **maybe:** add compactMap and optional helpers ([7edddc2](https://github.com/alanrsoares/onrails/commit/7edddc2bc95e8686e358fbd0806584faf43a8adf))
* **maybe:** add tagged Maybe with Result interop ([806e645](https://github.com/alanrsoares/onrails/commit/806e6453783b22aadbf12ef301be4f8615147e04))
* **maybe:** positional match, dual-form ops ([25c2bbd](https://github.com/alanrsoares/onrails/commit/25c2bbddb2bd9163be5eac5332c797b292bae9c8))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @onrails/result bumped to 0.1.0
  * peerDependencies
    * @onrails/result bumped to 0.1.0
