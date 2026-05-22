import type { Pattern } from "./match.js";

/** Guard pattern for {@link match}.with}. */
export const when = <T>(guard: (input: T) => boolean): Pattern<T> => guard;
