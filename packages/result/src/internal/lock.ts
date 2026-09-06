/**
 * Payload type produced by the literal-locking constructors (`ok` / `err` and
 * their async twins). Those take a `const` type parameter, so an inline literal
 * keeps its narrow type instead of widening (`"a"` stays `"a"`, not `string`).
 *
 * `const` inference also turns every array literal into a `readonly` tuple,
 * which would stop `ok([1, 2])` from satisfying `Result<number[], E>`. This
 * type undoes exactly that side effect and nothing else:
 *
 *   • tuple (fixed length)   → same positions, `readonly` dropped, elements locked
 *   • unbounded array        → left as authored (a `readonly T[]` input stays readonly)
 *   • anything else          → untouched (objects keep their deep-readonly literal shape)
 */
export type Locked<T> = T extends readonly unknown[]
  ? number extends T["length"]
    ? T
    : { -readonly [K in keyof T]: Locked<T[K]> }
  : T;
