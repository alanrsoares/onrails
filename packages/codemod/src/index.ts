#!/usr/bin/env bun
import { main } from "./cli.js";

export { rewriteCompatMethodChainsToNative } from "./chains.js";
export { main } from "./cli.js";
export { computeFileChange } from "./file-change.js";
export { rewriteCompatImportsToNative } from "./imports.js";
export { computePkgRewrite } from "./pkg.js";
export { tersify } from "./tersify.js";
export { collectNativeMigrationWarnings } from "./warnings.js";

if (import.meta.main) await main();
