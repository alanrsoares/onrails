/**
 * Shared tsup options for `@onrails/*` packages.
 * Each pure-TS package spreads these in its own `tsup.config.ts` and
 * supplies the entry list for its subpath exports.
 */
import type { Options } from "tsup";

export const baseTsupOptions: Options = {
  sourcemap: true,
  clean: true,
  dts: {
    compilerOptions: {
      ignoreDeprecations: "6.0",
    },
  },
  format: ["esm", "cjs"],
  splitting: false,
  treeshake: true,
  target: "es2022",
};
