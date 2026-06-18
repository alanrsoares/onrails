import { type Maybe, none, some } from "@onrails/maybe";
import { countOccurrences } from "./ast.js";
import { rewriteCompatMethodChainsToNative } from "./chains.js";
import { COMPAT_SPEC, IMPORT_RE, NATIVE_SPEC } from "./constants.js";
import { rewriteCompatImportsToNative } from "./imports.js";
import { tersify } from "./tersify.js";
import type { ComputedChange, FileChange, Mode, ModeStrategy, Warning } from "./types.js";
import {
  collectNativeMigrationWarnings,
  collectUnsupportedCompatImportWarnings,
} from "./warnings.js";

const rewriteCompatToNative = (src: string, jsx: boolean): string =>
  rewriteCompatMethodChainsToNative(rewriteCompatImportsToNative(src), jsx);

const rewriteNeverthrowToCompat = (src: string): string =>
  src.replace(IMPORT_RE, (_, lead, quote) => `${lead}${quote}${COMPAT_SPEC}${quote}`);

const collectAllNativeWarnings = (next: string, jsx: boolean): readonly Warning[] => [
  ...collectUnsupportedCompatImportWarnings(next),
  ...collectNativeMigrationWarnings(next, jsx),
];

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

export const computeFileChange = (src: string, mode: Mode, jsx = false): Maybe<ComputedChange> => {
  const strat = MODES[mode];
  const before = strat.countBefore(src);
  if (strat.earlyExit(src, before)) return none();
  const next = strat.transform(src, jsx);
  const changed = next !== src;
  const warnings = strat.warnings(next, jsx);
  return !changed && warnings.length === 0
    ? none()
    : some({ next, before, after: strat.countAfter(next), changed, warnings });
};

export const toFileChange = (path: string, c: ComputedChange): FileChange => ({
  path,
  before: c.before,
  after: c.after,
  changed: c.changed,
  warnings: c.warnings,
});
