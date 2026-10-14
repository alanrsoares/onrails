# Changelog

## [0.2.0](https://github.com/alanrsoares/onrails/compare/eslint-plugin-v0.1.4...eslint-plugin-v0.2.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **result:** Result and Maybe carriers are now objects with methods on a non-enumerable prototype. ok(), err(), some() and none() return them; the _tag / value / error fields are unchanged and JSON.stringify output is the same. Hand-written { _tag: "Ok", value }, { _tag: "Err", error }, { _tag: "Some", value } and { _tag: "None" } literals are no longer Result or Maybe; run onrails-codemod --literals to rewrite them to ok() / err() / some() / none(). Data that went through JSON.parse, structuredClone, postMessage, spread or a Redux / IndexedDB round-trip has lost its methods; lift it with Result.from(data) or Maybe.from(data). Result methods follow core semantics: tap does not swallow throws and recover keeps the Ok type. The carrier-sinks-need-from lint rule (ESLint and Biome) flags JSON.parse, structuredClone and .json() output typed as Result / Maybe without from(); the Biome rule only matches the as cast form.

### Features

* **biome-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **codemod:** rewrite carrier literals to constructors ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **eslint-plugin:** add carrier-sinks-need-from rule ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))
* **result:** prototype carriers, neverthrow parity ([92097e9](https://github.com/alanrsoares/onrails/commit/92097e9baa2d7b39858a718b41033b8d25bb97dd))


### Bug Fixes

* **eslint-plugin:** follow carrier sinks through flow ([#106](https://github.com/alanrsoares/onrails/issues/106)) ([ee9d171](https://github.com/alanrsoares/onrails/commit/ee9d17198f9944fb1f5904d0f009e169d0deaf18))

## [0.1.4](https://github.com/alanrsoares/onrails/compare/eslint-plugin-v0.1.3...eslint-plugin-v0.1.4) (2026-07-04)


### Features

* **codemod:** fluent-stays-local rule across engines ([#86](https://github.com/alanrsoares/onrails/issues/86)) ([f7b1f5d](https://github.com/alanrsoares/onrails/commit/f7b1f5dcb9cd82a4a4df713304168292c13ab649))

## [0.1.3](https://github.com/alanrsoares/onrails/compare/eslint-plugin-v0.1.2...eslint-plugin-v0.1.3) (2026-07-03)


### Features

* **codemod:** boundary spec owns enforced idiom names ([#78](https://github.com/alanrsoares/onrails/issues/78)) ([b00335e](https://github.com/alanrsoares/onrails/commit/b00335ec37248843b37bdcc45cb2cd74313b5d7a))

## [0.1.2](https://github.com/alanrsoares/onrails/compare/eslint-plugin-v0.1.1...eslint-plugin-v0.1.2) (2026-06-13)


### Features

* **api:** api coherence ([#21](https://github.com/alanrsoares/onrails/issues/21)) ([9150057](https://github.com/alanrsoares/onrails/commit/915005747d25e049bc45f3bf6ffc944b274501ac))

## [0.1.1](https://github.com/alanrsoares/onrails/compare/eslint-plugin-v0.1.0...eslint-plugin-v0.1.1) (2026-06-11)


### Bug Fixes

* **repo:** quality review fixes and cleanup ([#14](https://github.com/alanrsoares/onrails/issues/14)) ([29a606a](https://github.com/alanrsoares/onrails/commit/29a606a5ab8eb668b9fbcde282838d4cfd73b33f))

## 0.1.0 (2026-05-28)


### Features

* dual-form API, variadic pipe, point-free recipes, biome plugin ([f9670e7](https://github.com/alanrsoares/onrails/commit/f9670e71daa644424445460105dcf62be66982e8))
* **eslint-plugin:** ast rule + auto-fix + tests ([fc3932f](https://github.com/alanrsoares/onrails/commit/fc3932f5c2de9356fc941428294739970e5d36d6))
