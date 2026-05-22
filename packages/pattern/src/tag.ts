type Tagged = { readonly _tag: string };

type TagHandlers<T extends Tagged, R> = {
  [K in T["_tag"]]: (value: Extract<T, { _tag: K }>) => R;
};

/**
 * Exhaustive match on `_tag` — for `@onrails/result` / `@onrails/maybe` style unions.
 */
export const matchTag = <T extends Tagged, R>(value: T, handlers: TagHandlers<T, R>): R => {
  const tag = value._tag as T["_tag"];
  const handler = handlers[tag] as (value: Extract<T, { _tag: typeof tag }>) => R;
  return handler(value as Extract<T, { _tag: typeof tag }>);
};
