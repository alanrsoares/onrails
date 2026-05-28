#!/usr/bin/env bun
import { relative, resolve } from "node:path";
import {
  compactMap,
  fromNullable,
  type Maybe,
  match as matchMaybe,
  none,
  some,
} from "@onrails/maybe";
import { match as matchResult, type Result, trySync } from "@onrails/result";
import { Glob } from "bun";
import * as ts from "typescript";

type Mode = "compat" | "native";
type Args = { target: string; dry: boolean; onrails: string; mode: Mode };

const SKIP = new Set(["node_modules", "dist", ".git", ".next", ".turbo", "coverage", "build"]);
const CODE_EXT = /\.(ts|tsx|mts|cts)$/;
const IMPORT_RE = /(from\s+|import\s*\(\s*)(['"])neverthrow\2/g;
const COMPAT_SPEC = "@onrails/result/compat/neverthrow";
const NATIVE_SPEC = "@onrails/result";
const DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies"] as const;
const TYPE_ONLY_NATIVE = new Set(["Result", "Ok", "Err", "UnexpectedError"]);
const COMPAT_ONLY_PATTERNS = [
  { pattern: /\bResult\.(combine|fromThrowable)\b/g, label: "Result static helper" },
  { pattern: /\._unsafeUnwrap(Err)?\s*\(/g, label: "unsafe compat unwrap" },
] as const;
const RESULT_SPECIFIC_CHAIN_METHODS = new Set([
  "andThen",
  "chain",
  "flatMap",
  "mapErr",
  "orElse",
  "recover",
  "tapErr",
  "match",
  "unwrapOr",
]);
const CHAIN_METHODS = new Map([
  ["map", "map"],
  ["mapErr", "mapErr"],
  ["andThen", "flatMap"],
  ["chain", "flatMap"],
  ["flatMap", "flatMap"],
  ["orElse", "recover"],
  ["recover", "recover"],
  ["tap", "tap"],
  ["tapErr", "tapErr"],
]);
const TERMINAL_METHODS = new Set(["match", "unwrapOr"]);
const ASYNC_ROOT_HINTS = ["ResultAsync", "okAsync", "errAsync", "fromPromise", "fromSafePromise"];
const ZERO_ARG_HELPERS = new Map([
  ["ok", "ok(undefined)"],
  ["okAsync", "okAsync(undefined)"],
]);
const TEE_METHODS = new Map([
  ["andTee", "tap"],
  ["orTee", "tapErr"],
]);
const PREDICATE_METHODS = new Set(["isOk", "isErr"]);
const UNSAFE_UNWRAP_METHODS = new Map([
  ["_unsafeUnwrap", "unwrapOk"],
  ["_unsafeUnwrapErr", "unwrapErr"],
]);

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  let dry = false;
  let mode: Mode = "compat";
  let onrails = resolve(import.meta.dir, "../../..", "packages/result");
  for (const a of argv) {
    if (a === "--dry" || a === "-n") dry = true;
    else if (a === "--to-native") mode = "native";
    else if (a.startsWith("--onrails=")) onrails = resolve(a.slice("--onrails=".length));
    else if (!a.startsWith("--")) positional.push(a);
  }
  if (positional.length !== 1) {
    console.error(
      "usage: onrails-codemod-neverthrow <target-dir> [--dry] [--to-native] [--onrails=<abs-path>]",
    );
    process.exit(2);
  }
  return { target: resolve(positional[0] ?? "."), dry, onrails, mode };
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

type Warning = { line: number; label: string; text: string };
type FileChange = {
  path: string;
  before: number;
  after: number;
  changed: boolean;
  warnings: Warning[];
};
type Edit = { start: number; end: number; text: string; imports: readonly string[] };
type ChainStep = { method: string; argsText: string; argCount: number };
type PipelinePart = { importName: string; text: string };

const edit = (text: string, imports: readonly string[] = []): Edit => ({
  start: 0,
  end: 0,
  text,
  imports,
});

const splitImportNames = (specifiers: string): readonly string[] =>
  specifiers
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const stripInlineType = (specifier: string): string => specifier.replace(/^type\s+/, "");

const importedName = (specifier: string): string =>
  stripInlineType(specifier).split(/\s+as\s+/i)[0] ?? specifier;

const isTypeOnlyNative = (specifier: string): boolean =>
  specifier.startsWith("type ") || TYPE_ONLY_NATIVE.has(importedName(specifier));

function toNativeImport(full: string, specifiers: string, quote: string): string {
  const imports = splitImportNames(specifiers);
  const typeNames = imports.filter(isTypeOnlyNative).map(stripInlineType);
  const valueNames = imports.filter((name) => !isTypeOnlyNative(name));
  const chunks: string[] = [];

  if (valueNames.length > 0) {
    chunks.push(`import { ${valueNames.join(", ")} } from ${quote}${NATIVE_SPEC}${quote};`);
  }

  if (typeNames.length > 0) {
    chunks.push(`import type { ${typeNames.join(", ")} } from ${quote}${NATIVE_SPEC}${quote};`);
  }

  return chunks.length > 0 ? chunks.join("\n") : full;
}

export function rewriteCompatImportsToNative(src: string): string {
  const namedImportRe = new RegExp(
    String.raw`import\s+\{\s*([^}]+?)\s*\}\s+from\s+(['"])${COMPAT_SPEC.replaceAll("/", String.raw`\/`)}\2\s*;?`,
    "g",
  );
  const typeNamedImportRe = new RegExp(
    String.raw`import\s+type\s+\{\s*([^}]+?)\s*\}\s+from\s+(['"])${COMPAT_SPEC.replaceAll("/", String.raw`\/`)}\2\s*;?`,
    "g",
  );

  return src
    .replace(typeNamedImportRe, (_full, specifiers: string, quote: string) => {
      const imports = splitImportNames(specifiers);
      return `import type { ${imports.join(", ")} } from ${quote}${NATIVE_SPEC}${quote};`;
    })
    .replace(namedImportRe, (full: string, specifiers: string, quote: string) =>
      toNativeImport(full, specifiers, quote),
    );
}

function isSupportedChainCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const method = node.expression.name.text;
  return CHAIN_METHODS.has(method) || TERMINAL_METHODS.has(method);
}

function helperCallToNative(node: ts.CallExpression): Maybe<Edit> {
  if (ts.isIdentifier(node.expression) && node.arguments.length === 0) {
    return matchMaybe(
      fromNullable(ZERO_ARG_HELPERS.get(node.expression.text)),
      (text) => some(edit(text)),
      none,
    );
  }

  if (!ts.isPropertyAccessExpression(node.expression)) return none();
  const method = node.expression.name.text;
  const base = node.expression.expression
    .getText()
    .replaceAll(".andTee(", ".tap(")
    .replaceAll(".orTee(", ".tapErr(");
  const argsText = node.arguments.map((arg) => arg.getText()).join(", ");

  const teeMethod = TEE_METHODS.get(method);
  if (teeMethod) return some(edit(`${base}.${teeMethod}(${argsText})`));

  if (PREDICATE_METHODS.has(method)) {
    return some(edit(`${method}(${base})`, [method]));
  }

  const unwrapMethod = UNSAFE_UNWRAP_METHODS.get(method);
  if (unwrapMethod) return some(edit(`${unwrapMethod}(${base})`, [unwrapMethod]));

  return none();
}

function isNestedInSupportedChain(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (!ts.isPropertyAccessExpression(parent)) return false;
  return isSupportedChainCall(parent.parent);
}

function collectChain(node: ts.CallExpression): { base: string; steps: ChainStep[] } {
  const steps: ChainStep[] = [];
  let current: ts.Expression = node;

  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    const method = current.expression.name.text;
    if (!CHAIN_METHODS.has(method) && !TERMINAL_METHODS.has(method)) break;
    steps.push({
      method,
      argsText: current.arguments.map((arg) => arg.getText()).join(", "),
      argCount: current.arguments.length,
    });
    current = current.expression.expression;
  }

  return {
    base: current.getText(),
    steps: steps.reverse(),
  };
}

const hasAsyncRootHint = (base: string): boolean =>
  ASYNC_ROOT_HINTS.some((hint) => base.includes(hint));

const isSafeSyncChainBase = (base: string): boolean =>
  /^(ok|err)\s*\(/.test(base) || /^Result\./.test(base) || /^[a-zA-Z_$][\w$]*$/.test(base);

function chainToNative(base: string, steps: readonly ChainStep[]): Maybe<Edit> {
  if (steps.length === 0 || hasAsyncRootHint(base)) return none();
  const terminalStep = steps.find((step) => TERMINAL_METHODS.has(step.method));
  if (!isSafeSyncChainBase(base)) return none();
  if (!terminalStep && !steps.some((step) => RESULT_SPECIFIC_CHAIN_METHODS.has(step.method))) {
    return none();
  }
  if (terminalStep?.method === "match" && terminalStep.argCount !== 2) return none();
  const pipelineSteps = steps.filter((step) => CHAIN_METHODS.has(step.method));
  const pipelineParts = compactMap(pipelineSteps, (step) =>
    matchMaybe(
      fromNullable(CHAIN_METHODS.get(step.method)),
      (nativeName): Maybe<PipelinePart> =>
        some({ importName: nativeName, text: `${nativeName}(${step.argsText})` }),
      none,
    ),
  );

  if (pipelineParts.length !== pipelineSteps.length) return none();

  const parts = pipelineParts.map((part) => part.text);
  const imports = new Set(pipelineParts.map((part) => part.importName));
  const pipeline = parts.length > 0 ? `pipe(${[base, ...parts].join(", ")})` : base;

  if (parts.length > 0) imports.add("pipe");

  if (!terminalStep) {
    return some(edit(pipeline, [...imports]));
  }

  imports.add(terminalStep.method);
  return some(edit(`${terminalStep.method}(${pipeline}, ${terminalStep.argsText})`, [...imports]));
}

function addNativeValueImports(src: string, imports: readonly string[]): string {
  const names = [...new Set(imports)].sort();
  if (names.length === 0) return src;
  const importRe = new RegExp(
    String.raw`import\s+\{\s*([^}]*?)\s*\}\s+from\s+(['"])${NATIVE_SPEC.replaceAll("/", String.raw`\/`)}\2\s*;?`,
  );
  const match = importRe.exec(src);

  if (!match?.[1]) {
    return `import { ${names.join(", ")} } from "${NATIVE_SPEC}";\n${src}`;
  }

  const existing = splitImportNames(match[1]).map(stripInlineType);
  const next = [...new Set([...existing, ...names])].sort();
  return `${src.slice(0, match.index)}import { ${next.join(", ")} } from ${match[2]}${NATIVE_SPEC}${match[2]};${src.slice(match.index + match[0].length)}`;
}

export function rewriteCompatMethodChainsToNative(src: string): string {
  const sourceFile = ts.createSourceFile("codemod.ts", src, ts.ScriptTarget.Latest, true);
  const edits: Edit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const handled = matchMaybe(
        helperCallToNative(node),
        (helperEdit) => {
          edits.push({
            ...helperEdit,
            start: node.getStart(sourceFile),
            end: node.getEnd(),
          });
          return true;
        },
        () => false,
      );
      if (handled) return;
    }

    if (
      isSupportedChainCall(node) &&
      !isNestedInSupportedChain(node) &&
      !ts.isPropertyAccessExpression(node.parent)
    ) {
      const chain = collectChain(node);
      matchMaybe(
        chainToNative(chain.base, chain.steps),
        (edit) => {
          edits.push({
            ...edit,
            start: node.getStart(sourceFile),
            end: node.getEnd(),
          });
        },
        () => undefined,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (edits.length === 0) return src;

  let next = src;
  const imports = new Set<string>();
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
    for (const name of edit.imports) imports.add(name);
  }

  return addNativeValueImports(next, [...imports]);
}

export function collectNativeMigrationWarnings(src: string): readonly Warning[] {
  const warnings: Warning[] = [];
  const lines = src.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    for (const { pattern, label } of COMPAT_ONLY_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        warnings.push({ line: index + 1, label, text: line.trim() });
      }
    }
  }

  const sourceFile = ts.createSourceFile("codemod.ts", src, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === "isOk" || method === "isErr") {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        warnings.push({
          line,
          label: "compat predicate method",
          text: lines[line - 1]?.trim() ?? node.getText(sourceFile),
        });
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const property = node.name.text;
      if (property === "value" || property === "error") {
        const receiver = node.expression.getText(sourceFile);
        if (/result$/i.test(receiver) || /^result$/i.test(receiver)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          warnings.push({
            line,
            label: "compat value/error property",
            text: lines[line - 1]?.trim() ?? node.getText(sourceFile),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return warnings;
}

function collectUnsupportedCompatImportWarnings(src: string): readonly Warning[] {
  const warnings: Warning[] = [];
  const lines = src.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!line.includes(COMPAT_SPEC)) continue;
    warnings.push({
      line: index + 1,
      label: "unsupported compat import",
      text: line.trim(),
    });
  }

  return warnings;
}

async function rewriteCode(path: string, dry: boolean, mode: Mode): Promise<FileChange | null> {
  const src = await Bun.file(path).text();
  const targetSpec = mode === "compat" ? "neverthrow" : COMPAT_SPEC;
  if (mode === "compat" && !src.includes(targetSpec)) return null;
  const before =
    mode === "compat" ? (src.match(IMPORT_RE) ?? []).length : src.split(COMPAT_SPEC).length - 1;
  if (mode === "compat" && before === 0) return null;
  const next =
    mode === "compat"
      ? src.replace(IMPORT_RE, (_, lead, quote) => `${lead}${quote}${COMPAT_SPEC}${quote}`)
      : rewriteCompatMethodChainsToNative(rewriteCompatImportsToNative(src));
  const changed = next !== src;
  const warnings =
    mode === "native"
      ? [...collectUnsupportedCompatImportWarnings(next), ...collectNativeMigrationWarnings(next)]
      : [];
  if (!changed && warnings.length === 0) return null;
  if (changed && !dry) await Bun.write(path, next);
  return {
    path,
    before,
    after: mode === "native" ? next.split(NATIVE_SPEC).length - 1 : 0,
    changed,
    warnings,
  };
}

type PkgChange = { path: string; removed: string[]; addedAs: string };

const reorderDeps = (deps: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const parsePackageJson = (raw: string): Result<Record<string, unknown>, Error> =>
  trySync(() => JSON.parse(raw) as Record<string, unknown>, toError)();

async function rewritePkg(
  path: string,
  onrailsAbs: string,
  dry: boolean,
): Promise<PkgChange | null> {
  const raw = await Bun.file(path).text();
  return matchResult(
    parsePackageJson(raw),
    async (json) => {
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
    },
    async () => null,
  );
}

async function main() {
  const { target, dry, onrails, mode } = parseArgs(Bun.argv.slice(2));
  const codeChanges: FileChange[] = [];
  const pkgChanges: PkgChange[] = [];
  for await (const file of walk(target)) {
    if (mode === "compat" && file.endsWith("/package.json")) {
      const c = await rewritePkg(file, onrails, dry);
      if (c) pkgChanges.push(c);
    } else if (CODE_EXT.test(file)) {
      const c = await rewriteCode(file, dry, mode);
      if (c) codeChanges.push(c);
    }
  }
  const label = dry ? "DRY" : "APPLY";
  console.log(`[${label}] target=${target}`);
  console.log(`[${label}] mode=${mode}`);
  if (mode === "compat") console.log(`[${label}] onrails=${onrails}`);
  const changedCodeCount = codeChanges.filter((c) => c.changed).length;
  console.log(`[${label}] code files changed: ${changedCodeCount}`);
  if (mode === "native") {
    console.log(`[${label}] code files reported only: ${codeChanges.length - changedCodeCount}`);
  }
  for (const c of codeChanges) {
    console.log(`  ${relative(target, c.path)}  (${c.before} import${c.before === 1 ? "" : "s"})`);
    for (const warning of c.warnings) {
      console.log(`    TODO line ${warning.line}: ${warning.label}: ${warning.text}`);
    }
  }
  if (mode === "compat") {
    console.log(`[${label}] package.json updated: ${pkgChanges.length}`);
    for (const c of pkgChanges) {
      console.log(`  ${relative(target, c.path)}  [${c.removed.join(", ")}] -> ${c.addedAs}`);
    }
  }
  if (dry) console.log(`[${label}] no files written. re-run without --dry to apply.`);
}

if (import.meta.main) await main();
