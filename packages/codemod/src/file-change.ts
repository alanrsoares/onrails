import { type Maybe, none, some } from "@onrails/maybe";
import { flow } from "@onrails/result";
import { concatCollectors, countOccurrences } from "./ast.js";
import { rewriteCompatMethodChainsToNative } from "./chains.js";
import { COMPAT_SPEC, IMPORT_RE, NATIVE_SPEC } from "./constants.js";
import { rewriteCompatImportsToNative } from "./imports.js";
import { tersify } from "./tersify.js";
import type { ComputedChange, FileChange, Mode, ModeStrategy } from "./types.js";
import {
  collectNativeMigrationWarnings,
  collectUnsupportedCompatImportWarnings,
} from "./warnings.js";

const rewriteCompatToNative = flow(rewriteCompatImportsToNative, rewriteCompatMethodChainsToNative);

const rewriteNeverthrowToCompat = (src: string): string =>
  src.replace(IMPORT_RE, (_, lead, quote) => `${lead}${quote}${COMPAT_SPEC}${quote}`);

const collectAllNativeWarnings = concatCollectors(
  collectUnsupportedCompatImportWarnings,
  collectNativeMigrationWarnings,
);

const MODES: Record<Mode, ModeStrategy> = {
  compat: {
    countBefore: (src) => (src.match(IMPORT_RE) ?? []).length,
    earlyExit: (_src, before) => before === 0,
    transform: rewriteNeverthrowToCompat,
    warnings: () => [],
    countAfter: () => 0,
  },
  native: {
    countBefore: (src) => countOccurrences(src, COMPAT_SPEC),
    earlyExit: () => false,
    transform: rewriteCompatToNative,
    warnings: collectAllNativeWarnings,
    countAfter: (next) => countOccurrences(next, NATIVE_SPEC),
  },
  tersify: {
    countBefore: () => 0,
    earlyExit: () => false,
    transform: tersify,
    warnings: () => [],
    countAfter: () => 0,
  },
};

export const computeFileChange = (src: string, mode: Mode): Maybe<ComputedChange> => {
  const strat = MODES[mode];
  const before = strat.countBefore(src);
  if (strat.earlyExit(src, before)) return none();
  const next = strat.transform(src);
  const changed = next !== src;
  const warnings = strat.warnings(next);
  if (!changed && warnings.length === 0) return none();
  return some({ next, before, after: strat.countAfter(next), changed, warnings });
};

export const toFileChange = (path: string, c: ComputedChange): FileChange => ({
  path,
  before: c.before,
  after: c.after,
  changed: c.changed,
  warnings: c.warnings,
});
