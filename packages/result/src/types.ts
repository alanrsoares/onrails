/** Tagged success/failure — no classes, tree-shake friendly. */
export type Result<T, E> =
  | { readonly _tag: "Ok"; readonly value: T }
  | { readonly _tag: "Err"; readonly error: E };

export type Ok<T, E = never> = Extract<Result<T, E>, { _tag: "Ok" }>;
export type Err<T, E> = Extract<Result<T, E>, { _tag: "Err" }>;

/** Thrown defect mapped when {@link fromAsync} has no `onDefect` */
export class UnexpectedError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "UnexpectedError";
  }
}
