/**
 * Constraint for the array overload of the literal-locking constructors (`ok` /
 * `err` and their async twins). Those take a `const` type parameter, so an
 * inline literal keeps its narrow type instead of widening (`"a"` stays `"a"`,
 * not `string`).
 *
 * `const` inference normally turns every array literal into a `readonly`
 * tuple, which would stop `ok([1, 2])` from satisfying `Result<number[], E>`.
 * A *mutable* array constraint makes the compiler infer a mutable tuple
 * instead, and recursing through `Payload[]` keeps nested array literals
 * mutable too (`ok([[1], [2]])` is `Result<[[1], [2]], never>`).
 *
 * Being a constraint rather than a conditional return type is what keeps
 * generic code inferable: an unresolved `T` comes back as `T`, never as a
 * deferred wrapper. Objects keep their deep-readonly literal shape.
 */
export type Payload =
  | Payload[]
  | object
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined;
