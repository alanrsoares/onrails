type Tagged = { readonly _tag: string };

type TagHandlers<T extends Tagged, R> = {
  [K in T["_tag"]]: (value: Extract<T, { _tag: K }>) => R;
};

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
export const matchTag = <T extends Tagged, R>(value: T, handlers: TagHandlers<T, R>): R => {
  const tag = value._tag as T["_tag"];
  const handler = handlers[tag] as (value: Extract<T, { _tag: typeof tag }>) => R;
  return handler(value as Extract<T, { _tag: typeof tag }>);
};
