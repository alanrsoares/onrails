import * as fc from "fast-check";
import { err, ok } from "../../src/result.js";
import type { Result } from "../../src/types.js";

export const arbResult: fc.Arbitrary<Result<number, string>> = fc.oneof(
  fc.integer().map((n) => ok<number, string>(n)),
  fc.string().map((s) => err<number, string>(s)),
);

/** Pure `number -> number` functions; same input always yields same output. */
export const arbFn: fc.Arbitrary<(n: number) => number> = fc
  .func(fc.integer())
  .map((f) => (n: number) => f(n));

/** Pure `string -> string` functions, for the error channel. */
export const arbErrFn: fc.Arbitrary<(s: string) => string> = fc
  .func(fc.string())
  .map((f) => (s: string) => f(s));
