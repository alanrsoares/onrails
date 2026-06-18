/**
 * Tagged optional value — a discriminated union over `_tag` where absence
 * (`None`) is an expected outcome, not a failure. Construct with {@link some} /
 * {@link none}, narrow with {@link isSome} / {@link isNone}, and collapse with
 * {@link match}.
 *
 * @example
 * ```ts
 * function findUser(id: string): Maybe<User> {
 *   return fromNullable(db.users.get(id));
 * }
 * ```
 */
export type Maybe<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };

/** The `Some` branch of a {@link Maybe} — a present value tagged `"Some"`. */
export type Some<T> = Extract<Maybe<T>, { _tag: "Some" }>;

/** The `None` branch of a {@link Maybe} — expected absence, tagged `"None"`. */
export type None = Extract<Maybe<never>, { _tag: "None" }>;
