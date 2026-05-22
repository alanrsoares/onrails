/** Use in `default` branches after manual narrowing — compile-time exhaustiveness check. */
export const assertNever = (value: never, message = "Unreachable"): never => {
  throw new Error(`${message}: ${String(value)}`);
};
