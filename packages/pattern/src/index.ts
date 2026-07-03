export { assertNever } from "./assert.js";
export type {
  ExhaustiveResult,
  ExhaustMatched,
  HandledUnion,
  IsExhaustive,
  NonExhaustiveError,
  RemainingCases,
} from "./exhaustive.js";
export { MatchBuilder, match, type Pattern } from "./match.js";
export type { Narrow, NarrowUnion } from "./narrow.js";
export { matchTag } from "./tag.js";
export { when } from "./when.js";
