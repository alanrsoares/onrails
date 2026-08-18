/** Normalize an unknown thrown value into an Error, for `trySync` / `fromThrowable` boundaries. */
export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
