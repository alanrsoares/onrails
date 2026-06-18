/**
 * Adds two numbers together.
 * @category Math
 * @param a the first addend
 * @param b the second addend
 * @returns the sum of `a` and `b`
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * A greeting string. See {@link add} for arithmetic.
 * @deprecated use a template literal instead
 */
export const greeting = "hello";

export type Pair = { left: number; right: number };
