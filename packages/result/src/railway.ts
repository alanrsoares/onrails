/**
 * `@onrails/result/railway` — named-context workflow builder plus its
 * functional companion.
 *
 *   • {@link Railway}        — fluent builder (`railway-core.ts`)
 *   • {@link railway} + step factories — point-free composition (`railway-steps.ts`)
 */

export {
  Railway,
  type RailwayInput,
  type RailwayMode,
  type RailwayOutput,
} from "./railway-core.js";
export {
  deriveNamed,
  fromAsyncNamed,
  fromPromiseNamed,
  fromResultNamed,
  fromSyncNamed,
  parallelNamed,
  parseWith,
  railway,
  requireNamed,
  select,
} from "./railway-steps.js";
