#!/usr/bin/env bun
/**
 * Local release: publish every @onrails package whose version is not on npm
 * yet. The fallback for when the Release workflow cannot publish; CI stays the
 * normal path (release-please bumps versions, tags and GitHub releases).
 *
 *   bun run release:all                 # publish what is missing
 *   bun run release:all -- --otp=123456 # npm 2FA code (shared by every publish)
 *   bun run release:all -- --dry-run    # pack + `npm publish --dry-run`
 *
 * Steps: preflight (on main, clean tree, up to date, `npm whoami`), build,
 * check:packaging, then per package in dependency order: `bun pm pack`
 * (rewrites workspace: / catalog: ranges) and `npm publish` of the tarball.
 * Stops at the first failure; a rerun skips what is already published.
 *
 * Provenance needs CI's OIDC identity, and bun >= 1.4.4 refuses to pack a
 * `publishConfig.provenance: true` it cannot honour, so each package.json has
 * it switched off while packing and restored right after.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $ } from "bun";

const ROOT = resolve(import.meta.dirname, "..");

// Dependencies first: codemod needs result/maybe/pattern; docgen needs result/pattern.
const ORDER = [
  "result",
  "pattern",
  "maybe",
  "twoslash",
  "codemod",
  "docgen",
  "eslint-plugin",
  "biome-plugin",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const otp = args.find((a) => a.startsWith("--otp="));

const fail = (message: string): never => {
  console.error(`release: ${message}`);
  process.exit(1);
};

type Pkg = { dir: string; name: string; version: string; private?: boolean };
const readPkg = (dir: string): Pkg => ({
  dir,
  ...JSON.parse(readFileSync(join(ROOT, "packages", dir, "package.json"), "utf8")),
});

// Every publishable package must have a place in ORDER.
const publishable = (await $`ls packages`.cwd(ROOT).text())
  .split("\n")
  .filter(Boolean)
  .map(readPkg)
  .filter((p) => !p.private)
  .map((p) => p.dir);
const unordered = publishable.filter((d) => !ORDER.includes(d));
if (unordered.length) fail(`add ${unordered.join(", ")} to ORDER in scripts/publish.ts`);

// Preflight. A dry run publishes nothing, so it only warns about git state.
const gitProblem = async (): Promise<string | null> => {
  const branch = (await $`git branch --show-current`.cwd(ROOT).text()).trim();
  if (branch !== "main") return `not on main (on ${branch})`;
  if ((await $`git status --porcelain`.cwd(ROOT).text()).trim()) return "working tree not clean";
  return null;
};
const problem = await gitProblem();
if (problem && !dryRun) fail(problem);
if (problem) console.warn(`release: ${problem} (ignored for --dry-run)`);
else await $`git pull --ff-only`.cwd(ROOT).quiet();
if ((await $`npm whoami`.nothrow().quiet()).exitCode !== 0) fail("not logged in to npm: run npm login");

const isPublished = async (p: Pkg) =>
  (await $`npm view ${`${p.name}@${p.version}`} version`.nothrow().quiet()).exitCode === 0;

const pending: Pkg[] = [];
for (const dir of ORDER) {
  const p = readPkg(dir);
  if (await isPublished(p)) console.log(`= ${p.name}@${p.version} already on npm`);
  else pending.push(p);
}
if (!pending.length) {
  console.log("Nothing to publish.");
  process.exit(0);
}

await $`bun run build`.cwd(ROOT);
await $`bun run check:packaging`.cwd(ROOT).quiet();

const packDir = mkdtempSync(join(tmpdir(), "onrails-release-"));
for (const p of pending) {
  const pkgJson = join(ROOT, "packages", p.dir, "package.json");
  const original = readFileSync(pkgJson, "utf8");
  writeFileSync(pkgJson, original.replace('"provenance": true', '"provenance": false'));
  let tarball: string;
  try {
    tarball = (
      await $`bun pm pack --destination ${packDir} --quiet`.cwd(join(ROOT, "packages", p.dir)).text()
    ).trim();
  } finally {
    writeFileSync(pkgJson, original);
  }
  const flags = [...(otp ? [otp] : []), ...(dryRun ? ["--dry-run"] : [])];
  console.log(`+ ${p.name}@${p.version}${dryRun ? " (dry run)" : ""}`);
  const res = await $`npm publish ${join(packDir, tarball.split("/").pop() ?? tarball)} --access public ${flags}`.nothrow();
  if (res.exitCode !== 0) fail(`publish failed for ${p.name}@${p.version}; fix it and rerun`);
}
console.log(dryRun ? "Dry run complete." : `Published ${pending.length} package(s).`);
