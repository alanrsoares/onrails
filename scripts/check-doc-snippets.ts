#!/usr/bin/env bun
/**
 * Compile-check every ```ts block in the listed docs against the live
 * source, strictly.
 *
 * Unlike `check-api-examples.ts`, nothing is stubbed: each block is compiled
 * as its own module and must bring its own imports and `declare` lines. A
 * block that is deliberately partial opts out with the fence info
 * ```ts nocheck — keep that rare.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript6";

const REPO_ROOT = resolve(import.meta.dirname, "..");

// Strict, self-contained blocks only. The READMEs and DESIGN docs still hold
// fragments; add them here once their blocks declare what they use.
const DOCS = ["packages/result/RECIPES.md"];

const PATHS = {
  "@onrails/result": ["packages/result/src/index.ts"],
  "@onrails/result/*": ["packages/result/src/*"],
  "@onrails/maybe": ["packages/maybe/src/index.ts"],
  "@onrails/maybe/*": ["packages/maybe/src/*"],
  "@onrails/pattern": ["packages/pattern/src/index.ts"],
  "@onrails/pattern/*": ["packages/pattern/src/*"],
};

type Snippet = { doc: string; line: number; body: string };

const FENCE = /^```(ts|typescript)([^\n]*)\n([\s\S]*?)^```/gm;

const extract = (doc: string): Snippet[] => {
  const text = readFileSync(join(REPO_ROOT, doc), "utf8");
  const out: Snippet[] = [];
  for (const m of text.matchAll(FENCE)) {
    if (/\bnocheck\b/.test(m[2] ?? "")) continue;
    const line = text.slice(0, m.index).split("\n").length;
    out.push({ doc, line, body: m[3] ?? "" });
  }
  return out;
};

const snippets = DOCS.flatMap(extract);
const outDir = join(REPO_ROOT, "node_modules/.cache/doc-snippets");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// `export {}` makes every block a module, so blocks never share scope.
const files = snippets.map((s, i) => {
  const file = join(outDir, `snippet-${i}.ts`);
  writeFileSync(file, `${s.body}\nexport {};\n`);
  return file;
});

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  skipLibCheck: true,
  noEmit: true,
  baseUrl: REPO_ROOT,
  paths: PATHS,
  types: [],
});

const byFile = new Map<string, ts.Diagnostic[]>();
for (const d of ts.getPreEmitDiagnostics(program)) {
  const f = d.file?.fileName;
  if (!f || !f.startsWith(outDir)) continue;
  byFile.set(f, [...(byFile.get(f) ?? []), d]);
}

let failed = 0;
snippets.forEach((s, i) => {
  const diags = byFile.get(files[i] as string) ?? [];
  if (!diags.length) return;
  failed += 1;
  console.error(`✗ ${s.doc}:${s.line}`);
  for (const d of diags) {
    const at = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line : 0;
    console.error(`    line ${s.line + 1 + at}: TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
  }
});

console.log(`Checked ${snippets.length} doc snippet(s) in ${DOCS.length} file(s); ${failed} failed.`);
if (failed) {
  console.error(`Fix the block, or mark it \`\`\`ts nocheck if it is deliberately partial. Files: ${relative(REPO_ROOT, outDir)}`);
  process.exit(1);
}
