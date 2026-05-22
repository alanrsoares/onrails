/** Tagged optional value — absence is not failure. */
export type Maybe<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };

export type Some<T> = Extract<Maybe<T>, { _tag: "Some" }>;
export type None = Extract<Maybe<never>, { _tag: "None" }>;
