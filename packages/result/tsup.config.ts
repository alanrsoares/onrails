import { defineConfig } from "tsup";

import { baseTsupOptions } from "../../tsup.base";

export default defineConfig({
  ...baseTsupOptions,
  entry: [
    "src/index.ts",
    "src/fluent.ts",
    "src/extra.ts",
    "src/pipe.ts",
    "src/railway.ts",
    "src/try-gen.ts",
    "src/compat/neverthrow.ts",
  ],
});
