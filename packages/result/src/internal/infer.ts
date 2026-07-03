/**
 * @onrails/result internal — the single payload-extraction pair.
 *
 * `InferOk` / `InferErr` pull the success/error type out of a {@link Result}
 * (tagged union) or a {@link ResultAsync} (class carrier), resolving to
 * `never` for anything else. Every module that needs to extract a payload
 * type imports from here; do not redeclare local copies.
 *
 * Internal only: not listed in package.json `exports` or tsup entries.
 * The package index re-exports the pair under the same names.
 */

import type { ResultAsync } from "../async.js";

/**
 * Extracts the `Ok` value type from a {@link Result} or {@link ResultAsync},
 * resolving to `never` for any other type.
 *
 * @example
 * ```ts
 * type T = InferOk<Result<number, string>>;        // number
 * type U = InferOk<ResultAsync<User, AppError>>;    // User
 * ```
 */
export type InferOk<R> = R extends { _tag: "Ok"; readonly value: infer T }
  ? T
  : R extends ResultAsync<infer T, unknown>
    ? T
    : never;

/**
 * Extracts the `Err` error type from a {@link Result} or {@link ResultAsync},
 * resolving to `never` for any other type. Mirror of {@link InferOk}.
 *
 * @example
 * ```ts
 * type E = InferErr<Result<number, string>>;        // string
 * type F = InferErr<ResultAsync<User, AppError>>;    // AppError
 * ```
 */
export type InferErr<R> = R extends { _tag: "Err"; readonly error: infer E }
  ? E
  : R extends ResultAsync<unknown, infer E>
    ? E
    : never;
