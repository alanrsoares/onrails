#!/usr/bin/env bun
import { main } from "./cli.js";

export {
  DEPRECATED_SYNONYM_RENAMES,
  DEPRECATED_SYNONYMS,
  type DeprecatedSynonym,
  ENGINE_DIVERGENCES,
  type EngineDivergence,
  NO_DEPRECATED_SYNONYMS_RULE,
  NO_PROMISE_RESULT_RULE,
  NO_UNSAFE_UNWRAP_RULE,
  UNSAFE_UNWRAP_CALL_NAMES,
  UNSAFE_UNWRAP_MEMBER_CALL_RE,
  UNSAFE_UNWRAP_MEMBER_RENAMES,
  UNSAFE_UNWRAP_NAMES,
} from "./boundary-spec.js";
export { rewriteCompatMethodChainsToNative } from "./chains.js";
export { main } from "./cli.js";
export { computeFileChange } from "./file-change.js";
export { rewriteCompatImportsToNative } from "./imports.js";
export { computePkgRewrite } from "./pkg.js";
export { tersify } from "./tersify.js";
export { collectNativeMigrationWarnings } from "./warnings.js";

if (import.meta.main) await main();
