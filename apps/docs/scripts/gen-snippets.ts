#!/usr/bin/env bun
/**
 * Extracts the `#region snippet` block from each module in `@onrails/examples`
 * and writes them to `lib/snippets.generated.ts` keyed by file name. The example
 * modules are type-checked, linted, and unit-tested by the normal gate, so every
 * rendered snippet is guaranteed to compile against the real API.
 *
 * Each entry has two forms:
 *  - `code`: the display snippet (region only, `export` stripped, fixture
 *    imports dropped, relative imports rewritten to package names).
 *  - `twoslash`: a self-contained module for twoslash — the shown region
 *    imports at the top, the fixtures hidden inside `---cut-start/end---`, and
 *    the body below — so twoslash compiles the whole thing but renders only the
 *    snippet, with live hover types.
 */
import { resolve } from "node:path";
import { Glob } from "bun";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const SRC = resolve(REPO_ROOT, "packages/examples/src");
const OUT = resolve(import.meta.dir, "../lib/snippets.generated.ts");

const rewriteImport = (line: string): string =>
  line.replace(
    /from "(?:\.\.\/)+([\w-]+)\/src\/(.+?)\.js"/,
    (_m, pkg: string, rest: string) =>
      rest === "index" ? `from "@onrails/${pkg}"` : `from "@onrails/${pkg}/${rest}"`,
  );

const isImport = (l: string) => /^\s*import\b/.test(l);
const isFixtureImport = (l: string) => /from\s+["'][^"']*fixtures[^"']*["']/.test(l);
const stripExport = (l: string) => l.replace(/^(\s*)export /, "$1");

const trim = (lines: string[]): string[] => {
  const out = [...lines];
  while (out.length > 0 && out[0]?.trim() === "") out.shift();
  while (out.length > 0 && out[out.length - 1]?.trim() === "") out.pop();
  return out;
};

const regionLines = (source: string): string[] | null => {
  const lines = source.split("\n");
  const start = lines.findIndex((l) => l.includes("#region snippet"));
  const end = lines.findIndex((l) => l.includes("#endregion"));
  if (start === -1 || end === -1 || end <= start) return null;
  return lines.slice(start + 1, end);
};

// Plain display form: region without fixture imports / exports.
const toDisplay = (region: string[]): string =>
  trim(region.filter((l) => !isFixtureImport(l)).map((l) => stripExport(rewriteImport(l)))).join("\n");

// Drop bindings from a hidden fixture import that the shown region already
// imports from the same module — otherwise twoslash sees duplicate identifiers.
const dedupeFixtureImports = (fixtureImports: string[], regionImports: string[]): string[] => {
  const named = new Map<string, Set<string>>(); // module -> shown binding names
  const namespaces = new Set<string>(); // modules the region imports `* as`
  for (const l of regionImports) {
    const ns = l.match(/^import \* as \w+ from "([^"]+)"/);
    if (ns?.[1]) {
      namespaces.add(ns[1]);
      continue;
    }
    const m = l.match(/^import (?:type )?\{ (.+?) \} from "([^"]+)"/);
    if (m?.[1] && m[2]) {
      const set = named.get(m[2]) ?? new Set<string>();
      for (const b of m[1].split(",")) set.add(b.trim().replace(/^type /, ""));
      named.set(m[2], set);
    }
  }
  const out: string[] = [];
  for (const l of fixtureImports) {
    const ns = l.match(/^import \* as \w+ from "([^"]+)"/);
    if (ns?.[1]) {
      if (!namespaces.has(ns[1])) out.push(l);
      continue;
    }
    const m = l.match(/^(import (?:type )?\{ )(.+?)( \} from ")([^"]+)(";?)$/);
    if (m?.[2] && m[4]) {
      const have = named.get(m[4]);
      const kept = m[2]
        .split(",")
        .map((s) => s.trim())
        .filter((b) => !have?.has(b.replace(/^type /, "")));
      if (kept.length > 0) out.push(`${m[1]}${kept.join(", ")}${m[3]}${m[4]}${m[5]}`);
      continue;
    }
    out.push(l);
  }
  return out;
};

// Twoslash form: shown imports, hidden fixtures, shown body.
const toTwoslash = (region: string[], fixtures: string): string => {
  const fx = fixtures.split("\n");
  const regionImports = region.filter((l) => isImport(l) && !isFixtureImport(l)).map(rewriteImport);
  const regionBody = trim(region.filter((l) => !isImport(l)).map(stripExport));
  const fixtureImports = dedupeFixtureImports(fx.filter(isImport).map(rewriteImport), regionImports);
  const fixtureBody = trim(fx.filter((l) => !isImport(l)));
  return [
    ...regionImports,
    "// ---cut-start---",
    ...fixtureImports,
    ...fixtureBody,
    "// ---cut-end---",
    ...regionBody,
  ].join("\n");
};

const fixturesSource = await Bun.file(resolve(SRC, "fixtures.ts")).text();

const entries: [string, { code: string; twoslash: string }][] = [];
for await (const rel of new Glob("*.ts").scan(SRC)) {
  const name = rel.replace(/\.ts$/, "");
  if (name === "fixtures") continue;
  const region = regionLines(await Bun.file(resolve(SRC, rel)).text());
  if (region === null) {
    console.warn(`skip ${rel}: no #region snippet`);
    continue;
  }
  entries.push([name, { code: toDisplay(region), twoslash: toTwoslash(region, fixturesSource) }]);
}

entries.sort(([a], [b]) => a.localeCompare(b));

const body = entries
  .map(([id, v]) => `  ${JSON.stringify(id)}: { code: ${JSON.stringify(v.code)}, twoslash: ${JSON.stringify(v.twoslash)} },`)
  .join("\n");
const out = `// Generated by scripts/gen-snippets.ts — do not edit.\n// Source: packages/examples/src/*.ts (type-checked + tested by the gate).\nexport const snippets = {\n${body}\n} as const;\n\nexport type SnippetId = keyof typeof snippets;\n`;

await Bun.write(OUT, out);
console.log(`Wrote ${entries.length} snippets to ${OUT}`);
