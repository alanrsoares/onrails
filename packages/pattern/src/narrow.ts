// Extract the target type from a TS type predicate `(x: any) => x is U`.
// Returns `never` for non-predicate functions, allowing callers to fall back.
// biome-ignore lint/suspicious/noExplicitAny: required so the type-predicate position typechecks
type GuardTarget<F> = F extends (input: any) => input is infer U ? U : never;

// For object patterns, prefer member extraction on discriminated unions; fall
// back to intersection when `T` is a single object type so structural matches
// still narrow (e.g. matching `{ status: "failed" }` on a `Job` with
// `status: JobStatus`).
type NarrowObject<T, P> = [Extract<T, P>] extends [never] ? T & P : Extract<T, P>;

/** Narrows `input` when `pattern` is a shallow object, literal discriminant, or type predicate. */
export type Narrow<T, P> = P extends (input: T) => boolean
  ? [GuardTarget<P>] extends [never]
    ? T
    : NarrowObject<T, GuardTarget<P>>
  : P extends Record<string, unknown>
    ? NarrowObject<T, P>
    : T extends P
      ? Extract<T, P>
      : T;
