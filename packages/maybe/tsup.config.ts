import { defineConfig } from "tsup";

import { baseTsupOptions } from "../../tsup.base";

export default defineConfig({
  ...baseTsupOptions,
  entry: ["src/index.ts", "src/fluent.ts", "src/interop.ts"],
  external: ["@onrails/result"],
});
