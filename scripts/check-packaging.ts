#!/usr/bin/env bun
/**
 * Packaging guard for the published `@onrails/*` packages. Runs after `build`.
 *
 * Three failure modes this catches, all of which only surface for consumers:
 *  1. `exports` subpaths and the `tsup` entry list drifting apart.
 *  2. `exports` targets that no build actually emitted.
 *  3. Stale or out-of-tree files inside `dist`, which `files: ["dist"]` ships.
 *
 * `publint` + `attw` then check the manifest/type-resolution surface itself.
 */
import { $ } from "bun";

type ExportEntry = string | { [condition: string]: ExportEntry };

type Manifest = {
  name: string;
  exports?: Record<string, ExportEntry>;
  scripts?: Record<string, string>;
};

const PACKAGES = ["docgen", "maybe", "pattern", "result", "twoslash"] as const;

const failures: string[] = [];
const fail = (pkg: string, message: string) => failures.push(`${pkg}: ${message}`);

/** Subpath targets, flattened across the nested conditions of an exports map. */
const targets = (entry: ExportEntry | undefined): string[] =>
  entry === undefined
    ? []
    : typeof entry === "string"
      ? [entry]
      : Object.values(entry).flatMap(targets);

/** `src/fluent.ts` -> `fluent`; the shared key between exports and entries. */
const moduleKey = (path: string): string =>
  path
    .replace(/^\.\//, "")
    .replace(/^(src|dist)\//, "")
    .replace(/\.(d\.ts|d\.cts|ts|js|cjs|mjs)$/, "");

const entryKeys = async (dir: string): Promise<Set<string>> => {
  const config = await Bun.file(`${dir}/tsup.config.ts`).text();
  const list = config.match(/entry:\s*\[([^\]]*)\]/)?.[1] ?? "";
  return new Set(
    [...list.matchAll(/["']([^"']+)["']/g)].map((m) => moduleKey(m[1] as string)),
  );
};

for (const pkg of PACKAGES) {
  const dir = `packages/${pkg}`;
  const manifest: Manifest = await Bun.file(`${dir}/package.json`).json();

  const exported = new Set(targets(manifest.exports).map(moduleKey));
  const entries = await entryKeys(dir);

  for (const key of exported) {
    if (!entries.has(key)) fail(manifest.name, `exports "${key}" has no tsup entry`);
  }
  for (const key of entries) {
    if (!exported.has(key)) fail(manifest.name, `tsup entry "${key}" is not exported`);
  }

  for (const target of targets(manifest.exports)) {
    if (!(await Bun.file(`${dir}/${target}`).exists())) {
      fail(manifest.name, `exports target ${target} was not emitted — run build`);
    }
  }

  for (const stale of ["dist/test", "dist/src"]) {
    if (await Bun.file(`${dir}/${stale}/index.js`).exists()) {
      fail(manifest.name, `${stale}/ is inside the published dist — stale build output`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✖ ${failures.length} packaging problem(s):\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`✓ exports/entries in sync and emitted (${PACKAGES.length} packages)`);

// Root-pinned binaries, so a packaging verdict never shifts under a floating
// tool version.
const bin = `${process.cwd()}/node_modules/.bin`;

for (const pkg of PACKAGES) {
  await $`${bin}/publint --strict`.cwd(`packages/${pkg}`);
  // `node16` only: every package declares `engines.node >= 18`, and node10
  // resolution cannot see `exports` subpaths at all.
  await $`${bin}/attw --pack --profile node16`.cwd(`packages/${pkg}`);
}
