import { defineConfig } from "tsup";

import { baseTsupOptions } from "../../tsup.base";

export default defineConfig({
  ...baseTsupOptions,
  entry: [
    "src/index.ts",
    "src/fluent.ts",
    "src/extra.ts",
    "src/interop.ts",
    "src/mcp.ts",
    "src/pipe.ts",
    "src/railway.ts",
    "src/try-gen.ts",
    "src/validation.ts",
    "src/compat/neverthrow.ts",
  ],
});
