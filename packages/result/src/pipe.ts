/**
 * Variadic point-free composition — chains up to nine unary fns left-to-right
 * into one reusable function. The first fn may take multiple arguments; the
 * rest are unary. Use {@link pipe} from `@onrails/result` when you already
 * have a starting value; use {@link flow} to define a reusable composed
 * function with no value yet.
 *
 * @example
 * ```ts
 * const parseUserName = flow(
 *   (raw: string) => parseConfig(raw),
 *   map((cfg) => cfg.user),
 *   flatMap((u) => (u.name ? ok(u.name) : err({ kind: "missing" as const }))),
 * );
 *
 * parseUserName(raw); // Result<string, ParseError | { kind: "missing" }>
 * ```
 */
export function flow<A extends readonly unknown[], B>(ab: (...a: A) => B): (...a: A) => B;
export function flow<A extends readonly unknown[], B, C>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
): (...a: A) => C;
export function flow<A extends readonly unknown[], B, C, D>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): (...a: A) => D;
export function flow<A extends readonly unknown[], B, C, D, E>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): (...a: A) => E;
export function flow<A extends readonly unknown[], B, C, D, E, F>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
): (...a: A) => F;
export function flow<A extends readonly unknown[], B, C, D, E, F, G>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
): (...a: A) => G;
export function flow<A extends readonly unknown[], B, C, D, E, F, G, H>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
): (...a: A) => H;
export function flow<A extends readonly unknown[], B, C, D, E, F, G, H, I>(
  ab: (...a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
  ef: (e: E) => F,
  fg: (f: F) => G,
  gh: (g: G) => H,
  hi: (h: H) => I,
): (...a: A) => I;
export function flow(
  first: (...args: unknown[]) => unknown,
  ...rest: ReadonlyArray<(x: unknown) => unknown>
): (...args: unknown[]) => unknown {
  return (...args: unknown[]) => {
    let acc = first(...args);
    for (const fn of rest) {
      acc = fn(acc);
    }
    return acc;
  };
}
