#!/usr/bin/env bun
import { relative, resolve } from "node:path";
/**
 * Codemod: migrate `neverthrow` imports + package.json deps to
 * `@onrails/result/compat/neverthrow`.
 *
 * Usage:
 *   bun run packages/result/scripts/codemod-neverthrow.ts <target-dir> [--dry] [--onrails=<abs-path>]
 *
 * - Rewrites import specifiers `"neverthrow"` -> `"@onrails/result/compat/neverthrow"`
 *   in `.ts` / `.tsx` / `.mts` / `.cts` files.
 * - Updates every `package.json` that lists `neverthrow` under
 *   `dependencies` / `devDependencies` / `peerDependencies`:
 *     - removes the `neverthrow` entry
 *     - adds `@onrails/result` with a `file:` path relative to the package.json
 * - Skips `node_modules`, `dist`, `.git`, `.next`, `.turbo`, `coverage`.
 * - Idempotent. Safe to re-run.
 */
import { Glob } from "bun";

type Args = { target: string; dry: boolean; onrails: string };

const SKIP = new Set(["node_modules", "dist", ".git", ".next", ".turbo", "coverage", "build"]);
const CODE_EXT = /\.(ts|tsx|mts|cts)$/;
const IMPORT_RE = /(from\s+|import\s*\(\s*)(['"])neverthrow\2/g;
const NEW_SPEC = "@onrails/result/compat/neverthrow";
const DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies"] as const;

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let dry = false;
  let onrails = resolve(import.meta.dir, "../../..", "packages/result");
  for (const a of argv) {
    if (a === "--dry" || a === "-n") dry = true;
    else if (a.startsWith("--onrails=")) onrails = resolve(a.slice("--onrails=".length));
    else if (!a.startsWith("--")) positional.push(a);
  }
  if (positional.length !== 1) {
    console.error(
      "usage: bun run codemod-neverthrow.ts <target-dir> [--dry] [--onrails=<abs-path>]",
    );
    process.exit(2);
  }
  return { target: resolve(positional[0] ?? "."), dry, onrails };
}

function shouldSkip(path: string): boolean {
  return path.split("/").some((seg) => SKIP.has(seg));
}

async function* walk(root: string): AsyncGenerator<string> {
  const glob = new Glob("**/*");
  for await (const rel of glob.scan({ cwd: root, dot: false, onlyFiles: true })) {
    if (!shouldSkip(rel)) yield `${root}/${rel}`;
  }
}

type FileChange = { path: string; before: number; after: number };

async function rewriteCode(path: string, dry: boolean): Promise<FileChange | null> {
  const src = await Bun.file(path).text();
  if (!src.includes("neverthrow")) return null;
  const before = (src.match(IMPORT_RE) ?? []).length;
  if (before === 0) return null;
  const next = src.replace(IMPORT_RE, (_, lead, quote) => `${lead}${quote}${NEW_SPEC}${quote}`);
  if (next === src) return null;
  if (!dry) await Bun.write(path, next);
  return { path, before, after: 0 };
}

type PkgChange = { path: string; removed: string[]; addedAs: string };

function reorderDeps(deps: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
}

async function rewritePkg(
  path: string,
  onrailsAbs: string,
  dry: boolean,
): Promise<PkgChange | null> {
  const raw = await Bun.file(path).text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const removed: string[] = [];
  let touched = false;
  const pkgDir = path.replace(/\/package\.json$/, "");
  const filePath = relative(pkgDir, onrailsAbs);
  const fileSpec = `file:${filePath}`;
  for (const key of DEP_KEYS) {
    const deps = json[key] as Record<string, string> | undefined;
    if (!deps || typeof deps !== "object") continue;
    if (!("neverthrow" in deps)) continue;
    delete deps.neverthrow;
    removed.push(key);
    deps["@onrails/result"] = fileSpec;
    json[key] = reorderDeps(deps);
    touched = true;
  }
  if (!touched) return null;
  const out = `${JSON.stringify(json, null, 2)}\n`;
  if (!dry) await Bun.write(path, out);
  return { path, removed, addedAs: fileSpec };
}

async function main() {
  const { target, dry, onrails } = parseArgs(Bun.argv.slice(2));
  const codeChanges: FileChange[] = [];
  const pkgChanges: PkgChange[] = [];
  for await (const file of walk(target)) {
    if (file.endsWith("/package.json")) {
      const c = await rewritePkg(file, onrails, dry);
      if (c) pkgChanges.push(c);
    } else if (CODE_EXT.test(file)) {
      const c = await rewriteCode(file, dry);
      if (c) codeChanges.push(c);
    }
  }
  const label = dry ? "DRY" : "APPLY";
  console.log(`[${label}] target=${target}`);
  console.log(`[${label}] onrails=${onrails}`);
  console.log(`[${label}] code files rewritten: ${codeChanges.length}`);
  for (const c of codeChanges) {
    console.log(`  ${relative(target, c.path)}  (${c.before} import${c.before === 1 ? "" : "s"})`);
  }
  console.log(`[${label}] package.json updated: ${pkgChanges.length}`);
  for (const c of pkgChanges) {
    console.log(`  ${relative(target, c.path)}  [${c.removed.join(", ")}] -> ${c.addedAs}`);
  }
  if (dry) console.log(`[${label}] no files written. re-run without --dry to apply.`);
}

await main();
