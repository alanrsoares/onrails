type Tagged = { readonly _tag: string };

type TagHandlers<T extends Tagged> = {
  [K in T["_tag"]]: (value: Extract<T, { _tag: K }>) => unknown;
};

// Return type is read off the handlers, not inferred through a mapped type: with `R` as a type
// parameter of `TagHandlers`, TypeScript 7 infers `unknown` for the result.
type HandlerResult<Hs> = {
  [K in keyof Hs]: Hs[K] extends (...args: never[]) => infer U ? U : never;
}[keyof Hs];

/**
 * Exhaustive match on `_tag` — for `@onrails/result` / `@onrails/maybe` style
 * unions. The `handlers` object must supply one branch per `_tag`, and each
 * handler receives the member narrowed to its tag.
 *
 * @param value - a tagged union value to dispatch on
 * @param handlers - one handler per `_tag`, keyed by tag
 * @returns the result of the matched handler
 *
 * @example
 * ```ts
 * import { err, ok, type Result } from "@onrails/result";
 *
 * const label = (r: Result<number, string>) =>
 *   matchTag(r, {
 *     Ok:  (v) => `ok:${v.value}`,  // v: Ok<number>
 *     Err: (e) => `err:${e.error}`, // e: Err<string>
 *   });
 * label(ok(1));    // "ok:1"
 * label(err("x")); // "err:x"
 * ```
 */
export const matchTag = <T extends Tagged, Hs extends TagHandlers<T>>(
  value: T,
  // Excess keys map to `never`, restoring the excess-property check lost by inferring `Hs`.
  handlers: Hs & { [K in Exclude<keyof Hs, T["_tag"]>]: never },
): HandlerResult<Hs> => {
  const handler = handlers[value._tag as keyof Hs] as (value: T) => HandlerResult<Hs>;
  return handler(value);
};
