#!/usr/bin/env bun
/**
 * Mirrors the emitted `.d.ts` tree as `.d.cts`, run from a package directory
 * after `tsc -p tsconfig.build.json`.
 *
 * `tsc` emits one declaration set, which Node interprets as ESM. Under the
 * `require` condition that set is unusable, so the CJS half of every export
 * needs its own `.d.cts`. The whole tree is mirrored — not just the entries —
 * because a `.d.cts` resolves its relative imports to `.d.cts` as well.
 */
import { Glob } from "bun";

const declarations = [...new Glob("**/*.d.ts").scanSync("dist")];

await Promise.all(
  declarations.map((path) =>
    Bun.write(`dist/${path.replace(/\.d\.ts$/, ".d.cts")}`, Bun.file(`dist/${path}`)),
  ),
);

console.log(`✓ mirrored ${declarations.length} declaration file(s) as .d.cts`);
