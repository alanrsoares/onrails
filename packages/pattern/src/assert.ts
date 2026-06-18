/**
 * Use in `default` branches (or after manual narrowing) to assert a union has
 * been fully handled. If every case is handled, `value` is `never` and the call
 * type-checks; an unhandled case makes `value` non-`never`, surfacing a compile
 * error. Always throws at runtime.
 *
 * @param value - the value that should be unreachable (typed `never`)
 * @param message - error message prefix; defaults to `"Unreachable"`
 * @throws always — the branch is meant to be unreachable
 *
 * @example
 * ```ts
 * type Shape = { kind: "circle"; r: number } | { kind: "square"; s: number };
 *
 * function area(shape: Shape): number {
 *   switch (shape.kind) {
 *     case "circle": return Math.PI * shape.r ** 2;
 *     case "square": return shape.s ** 2;
 *     default: return assertNever(shape); // type error if a case is added
 *   }
 * }
 * ```
 */
export const assertNever = (value: never, message = "Unreachable"): never => {
  throw new Error(`${message}: ${String(value)}`);
};
