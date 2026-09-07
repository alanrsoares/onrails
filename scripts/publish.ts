#!/usr/bin/env bun
/**
 * Monorepo publish script for @onrails packages.
 *
 * Iterates through all packages in `packages/*` and runs `bun publish --access public`.
 * Forwards any CLI flags (e.g. `--dry-run`, `--tolerate-republish`, `--tag`).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const packagesDir = join(import.meta.dir, "..", "packages");
const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(packagesDir, d.name));

const extraArgs = process.argv.slice(2);

for (const dir of dirs) {
  const pkgJsonPath = join(dir, "package.json");
  const pkgFile = Bun.file(pkgJsonPath);
  if (!(await pkgFile.exists())) continue;

  const pkgJson = await pkgFile.json();
  if (pkgJson.private) {
    console.log(`Skipping private package ${pkgJson.name}`);
    continue;
  }

  console.log(`\n📦 Publishing ${pkgJson.name}@${pkgJson.version}...`);
  await $`bun publish --cwd ${dir} --access public ${extraArgs}`;
}
