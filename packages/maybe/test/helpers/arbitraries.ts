import * as fc from "fast-check";
import { type Maybe, none, some } from "../../src/maybe.js";

export const arbMaybe: fc.Arbitrary<Maybe<number>> = fc.oneof(
  fc.integer().map((n) => some(n)),
  fc.constant(none<number>()),
);

/** Pure `number -> number` functions; same input always yields same output. */
export const arbFn: fc.Arbitrary<(n: number) => number> = fc
  .func(fc.integer())
  .map((f) => (n: number) => f(n));
