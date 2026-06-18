/**
 * @onrails/result — public surface.
 *
 * Layout:
 *   • core railway          — ok/err, map/flatMap, match, recover, tap, trySync, pipe
 *   • collection (sync)     — combine, combineTuple
 *   • async                 — ResultAsync, fromPromise, tryAsync
 *   • async collection      — ResultAsync.combineTuple, parallelTupleAsync
 *   • sync ↔ async lift     — fromResult, fromAsync, asyncAfter
 *   • generator sugar       — tryGen, yieldResult, $
 *   • types                 — Result, Ok, Err, UnexpectedError
 *
 * Decision tree:
 *   single sync value         → flatMap / match
 *   single async value        → ResultAsync.flatMap / asyncAfter
 *   named multi-step workflow → @onrails/result/railway
 *   generator-style sync sugar → @onrails/result/try-gen
 *   independent validations   → @onrails/result/validation
 */

export {
  errAsync,
  fromPromise,
  fromSafePromise,
  okAsync,
  parallelTupleAsync,
  ResultAsync,
  tryAsync,
} from "./async.js";
export {
  asyncAfter,
  fromAsync,
  fromResult,
  type InferErr,
  type InferOk,
} from "./interop.js";
export { flow } from "./pipe.js";
export {
  bimap,
  combine,
  combineTuple,
  err,
  flatMap,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  pipe,
  recover,
  tap,
  tapErr,
  trySync,
  unwrapErr,
  unwrapOk,
  unwrapOr,
} from "./result.js";
export { $, tryGen, yieldResult } from "./try-gen.js";

export type { Err, Ok, Result, UnexpectedError } from "./types.js";
