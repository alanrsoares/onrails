/**
 * `@onrails/result/$` — alias barrel for the generator-style sync sugar.
 *
 * Re-exports everything from {@link ./try-gen}. Import from here when the `$`
 * unwrap operator reads better as the module's namesake:
 *
 * @example
 * ```ts
 * import { tryGen, $ } from "@onrails/result/$";
 *
 * const out = tryGen(() => {
 *   const a = $(parseA());
 *   const b = $(parseB());
 *   return ok(a + b);
 * });
 * ```
 */

export { $, tryGen, yieldResult } from "./try-gen.js";
