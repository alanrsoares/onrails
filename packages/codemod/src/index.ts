#!/usr/bin/env bun
import { relative, resolve } from "node:path";
import {
  compactMap,
  fromNullable,
  isSome,
  type Maybe,
  match as matchMaybe,
  none,
  some,
} from "@onrails/maybe";
import { flow, type Result, ResultAsync, trySync } from "@onrails/result";
import { Glob } from "bun";
import ts from "typescript";

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
  { pattern: /\bResult\.(combine|fromThrowable)\b/, label: "Result static helper" },
  { pattern: /\._unsafeUnwrap(Err)?\s*\(/, label: "unsafe compat unwrap" },
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

type ArgState = { positional: readonly string[]; dry: boolean; mode: Mode; onrails: string };

const applyArg = (s: ArgState, a: string): ArgState =>
  a === "--dry" || a === "-n"
    ? { ...s, dry: true }
    : a === "--to-native"
      ? { ...s, mode: "native" }
      : a.startsWith("--onrails=")
        ? { ...s, onrails: resolve(a.slice("--onrails=".length)) }
        : !a.startsWith("--")
          ? { ...s, positional: [...s.positional, a] }
          : s;

function parseArgs(argv: string[]): Args {
  const initial: ArgState = {
    positional: [],
    dry: false,
    mode: "compat",
    onrails: resolve(import.meta.dir, "../../..", "packages/result"),
  };
  const { positional, dry, mode, onrails } = argv.reduce(applyArg, initial);
  if (positional.length !== 1) {
    console.error(
      "usage: onrails-codemod-neverthrow <target-dir> [--dry] [--to-native] [--onrails=<abs-path>]",
    );
    process.exit(2);
  }
  return {
    target: resolve(positional[0] ?? "."),
    dry,
    onrails,
    mode,
  };
}

const shouldSkip = (path: string) => path.split("/").some((seg) => SKIP.has(seg));

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
  warnings: readonly Warning[];
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

const lookupMap = <K, V, R>(m: Map<K, V>, k: K, f: (v: V) => R): Maybe<R> =>
  matchMaybe(fromNullable(m.get(k)), (v) => some(f(v)), none);

const concatCollectors =
  <T, R>(...fns: Array<(t: T) => readonly R[]>) =>
  (t: T): readonly R[] =>
    fns.flatMap((f) => f(t));

const walkSource = (src: string, visit: (node: ts.Node, sf: ts.SourceFile) => unknown): void => {
  const sf = ts.createSourceFile("codemod.ts", src, ts.ScriptTarget.Latest, true);
  const go = (n: ts.Node) => {
    if (visit(n, sf)) return;
    ts.forEachChild(n, go);
  };
  go(sf);
};

const spanEdit = (node: ts.Node, sf: ts.SourceFile, partial: Edit): Edit => ({
  ...partial,
  start: node.getStart(sf),
  end: node.getEnd(),
});

const argsToText = (args: ts.NodeArray<ts.Expression>): string =>
  args.map((a) => a.getText()).join(", ");

const countOccurrences = (s: string, sub: string): number => s.split(sub).length - 1;

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

const isValueImport = (specifier: string): boolean => !isTypeOnlyNative(specifier);

function toNativeImport(full: string, specifiers: string, quote: string): string {
  const imports = splitImportNames(specifiers);
  const typeNames = imports.filter(isTypeOnlyNative).map(stripInlineType);
  const valueNames = imports.filter(isValueImport);
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
    return lookupMap(ZERO_ARG_HELPERS, node.expression.text, (text) => edit(text));
  }

  if (!ts.isPropertyAccessExpression(node.expression)) return none();
  const method = node.expression.name.text;
  const base = node.expression.expression
    .getText()
    .replaceAll(".andTee(", ".tap(")
    .replaceAll(".orTee(", ".tapErr(");
  const argsText = argsToText(node.arguments);

  const tee = lookupMap(TEE_METHODS, method, (t) => edit(`${base}.${t}(${argsText})`));
  if (isSome(tee)) return tee;

  if (PREDICATE_METHODS.has(method)) {
    return some(edit(`${method}(${base})`, [method]));
  }

  return lookupMap(UNSAFE_UNWRAP_METHODS, method, (u) => edit(`${u}(${base})`, [u]));
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
      argsText: argsToText(current.arguments),
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

const SAFE_BASE_PATTERNS = [/^(ok|err)\s*\(/, /^Result\./, /^[a-zA-Z_$][\w$]*$/] as const;

const isSafeSyncChainBase = (base: string): boolean =>
  SAFE_BASE_PATTERNS.some((re) => re.test(base));

const isTerminalStep = (s: ChainStep): boolean => TERMINAL_METHODS.has(s.method);
const isResultSpecificStep = (s: ChainStep): boolean => RESULT_SPECIFIC_CHAIN_METHODS.has(s.method);
const isChainStep = (s: ChainStep): boolean => CHAIN_METHODS.has(s.method);

function chainToNative(base: string, steps: readonly ChainStep[]): Maybe<Edit> {
  if (steps.length === 0 || hasAsyncRootHint(base)) return none();
  const terminalStep = steps.find(isTerminalStep);
  if (!isSafeSyncChainBase(base)) return none();
  if (!terminalStep && !steps.some(isResultSpecificStep)) return none();
  if (terminalStep?.method === "match" && terminalStep.argCount !== 2) return none();
  const pipelineSteps = steps.filter(isChainStep);
  const pipelineParts = compactMap(pipelineSteps, (step) =>
    lookupMap(
      CHAIN_METHODS,
      step.method,
      (nativeName): PipelinePart => ({
        importName: nativeName,
        text: `${nativeName}(${step.argsText})`,
      }),
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
  const edits: Edit[] = [];

  walkSource(src, (node, sf) => {
    if (ts.isCallExpression(node)) {
      const helper = helperCallToNative(node);
      if (isSome(helper)) {
        edits.push(spanEdit(node, sf, helper.value));
        return true;
      }
    }

    if (
      isSupportedChainCall(node) &&
      !isNestedInSupportedChain(node) &&
      !ts.isPropertyAccessExpression(node.parent)
    ) {
      const chain = collectChain(node);
      const chained = chainToNative(chain.base, chain.steps);
      if (isSome(chained)) edits.push(spanEdit(node, sf, chained.value));
    }
  });

  if (edits.length === 0) return src;

  const { src: next, imports } = edits
    .sort(byStartDesc)
    .reduce(applyEditStep, { src, imports: new Set<string>() });

  return addNativeValueImports(next, [...imports]);
}

type EditAcc = { src: string; imports: Set<string> };

const byStartDesc = (a: Edit, b: Edit): number => b.start - a.start;

const applyEditStep = (acc: EditAcc, e: Edit): EditAcc => ({
  src: `${acc.src.slice(0, e.start)}${e.text}${acc.src.slice(e.end)}`,
  imports: new Set([...acc.imports, ...e.imports]),
});

const collectRegexLineWarnings = (src: string): readonly Warning[] =>
  src
    .split(/\r?\n/)
    .flatMap((line, i) =>
      COMPAT_ONLY_PATTERNS.flatMap(({ pattern, label }) =>
        pattern.test(line) ? [{ line: i + 1, label, text: line.trim() }] : [],
      ),
    );

const collectAstCompatWarnings = (src: string): readonly Warning[] => {
  const warnings: Warning[] = [];
  const lines = src.split(/\r?\n/);
  const lineTextAt = (sf: ts.SourceFile, node: ts.Node) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    return { line, text: lines[line - 1]?.trim() ?? node.getText(sf) };
  };

  walkSource(src, (node, sf) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === "isOk" || method === "isErr") {
        warnings.push({ ...lineTextAt(sf, node), label: "compat predicate method" });
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const property = node.name.text;
      if (property === "value" || property === "error") {
        const receiver = node.expression.getText(sf);
        if (/result$/i.test(receiver) || /^result$/i.test(receiver)) {
          warnings.push({ ...lineTextAt(sf, node), label: "compat value/error property" });
        }
      }
    }
  });

  return warnings;
};

export const collectNativeMigrationWarnings = concatCollectors(
  collectRegexLineWarnings,
  collectAstCompatWarnings,
);

const collectUnsupportedCompatImportWarnings = (src: string): readonly Warning[] =>
  src.split(/\r?\n/).flatMap((line, i) =>
    line.includes(COMPAT_SPEC)
      ? [
          {
            line: i + 1,
            label: "unsupported compat import",
            text: line.trim(),
          },
        ]
      : [],
  );

const rewriteCompatToNative = flow(rewriteCompatImportsToNative, rewriteCompatMethodChainsToNative);

const rewriteNeverthrowToCompat = (src: string): string =>
  src.replace(IMPORT_RE, (_, lead, quote) => `${lead}${quote}${COMPAT_SPEC}${quote}`);

const collectAllNativeWarnings = concatCollectors(
  collectUnsupportedCompatImportWarnings,
  collectNativeMigrationWarnings,
);

type ModeStrategy = {
  countBefore: (src: string) => number;
  earlyExit: (src: string, before: number) => boolean;
  transform: (src: string) => string;
  warnings: (next: string) => readonly Warning[];
  countAfter: (next: string) => number;
};

const MODES: Record<Mode, ModeStrategy> = {
  compat: {
    countBefore: (src) => (src.match(IMPORT_RE) ?? []).length,
    earlyExit: (_src, before) => before === 0,
    transform: rewriteNeverthrowToCompat,
    warnings: () => [],
    countAfter: () => 0,
  },
  native: {
    countBefore: (src) => countOccurrences(src, COMPAT_SPEC),
    earlyExit: () => false,
    transform: rewriteCompatToNative,
    warnings: collectAllNativeWarnings,
    countAfter: (next) => countOccurrences(next, NATIVE_SPEC),
  },
};

type ComputedChange = {
  next: string;
  before: number;
  after: number;
  changed: boolean;
  warnings: readonly Warning[];
};

export const computeFileChange = (src: string, mode: Mode): Maybe<ComputedChange> => {
  const strat = MODES[mode];
  const before = strat.countBefore(src);
  if (strat.earlyExit(src, before)) return none();
  const next = strat.transform(src);
  const changed = next !== src;
  const warnings = strat.warnings(next);
  if (!changed && warnings.length === 0) return none();
  return some({ next, before, after: strat.countAfter(next), changed, warnings });
};

const toFileChange = (path: string, c: ComputedChange): FileChange => ({
  path,
  before: c.before,
  after: c.after,
  changed: c.changed,
  warnings: c.warnings,
});

const readFileText = (path: string): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(Bun.file(path).text(), toError);

const writeFileText = (path: string, content: string): ResultAsync<unknown, Error> =>
  ResultAsync.fromPromise(Bun.write(path, content), toError);

const rewriteCode = (
  path: string,
  dry: boolean,
  mode: Mode,
): ResultAsync<Maybe<FileChange>, Error> =>
  readFileText(path).flatMap((src) =>
    matchMaybe(
      computeFileChange(src, mode),
      (c) => {
        const change = toFileChange(path, c);
        return c.changed && !dry
          ? writeFileText(path, c.next).map(() => some(change))
          : ResultAsync.ok<Maybe<FileChange>, Error>(some(change));
      },
      () => ResultAsync.ok<Maybe<FileChange>, Error>(none()),
    ),
  );

type PkgChange = { path: string; removed: string[]; addedAs: string };

const reorderDeps = (deps: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const parsePackageJson = (raw: string): Result<Record<string, unknown>, Error> =>
  trySync(() => JSON.parse(raw) as Record<string, unknown>, toError)();

type PkgUpdate = { json: Record<string, unknown>; removed: readonly string[] };

const applyDepRewrite =
  (fileSpec: string) =>
  (acc: PkgUpdate, key: string): PkgUpdate => {
    const deps = acc.json[key] as Record<string, string> | undefined;
    if (!deps || typeof deps !== "object" || !("neverthrow" in deps)) return acc;
    const { neverthrow: _drop, ...rest } = deps;
    return {
      json: { ...acc.json, [key]: reorderDeps({ ...rest, "@onrails/result": fileSpec }) },
      removed: [...acc.removed, key],
    };
  };

type ComputedPkg = { json: Record<string, unknown>; removed: readonly string[]; fileSpec: string };

export const computePkgRewrite = (
  json: Record<string, unknown>,
  path: string,
  onrailsAbs: string,
): Maybe<ComputedPkg> => {
  const fileSpec = `file:${relative(path.replace(/\/package\.json$/, ""), onrailsAbs)}`;
  const updated = DEP_KEYS.reduce(applyDepRewrite(fileSpec), { json, removed: [] } as PkgUpdate);
  return updated.removed.length === 0
    ? none()
    : some({ json: updated.json, removed: updated.removed, fileSpec });
};

const toPkgChange = (path: string, c: ComputedPkg): PkgChange => ({
  path,
  removed: [...c.removed],
  addedAs: c.fileSpec,
});

const rewritePkg = (
  path: string,
  onrailsAbs: string,
  dry: boolean,
): ResultAsync<Maybe<PkgChange>, Error> =>
  readFileText(path)
    .flatMap((raw) => ResultAsync.fromResult(parsePackageJson(raw)))
    .flatMap((json) =>
      matchMaybe(
        computePkgRewrite(json, path, onrailsAbs),
        (c) => {
          const change = toPkgChange(path, c);
          return dry
            ? ResultAsync.ok<Maybe<PkgChange>, Error>(some(change))
            : writeFileText(path, `${JSON.stringify(c.json, null, 2)}\n`).map(() => some(change));
        },
        () => ResultAsync.ok<Maybe<PkgChange>, Error>(none()),
      ),
    );

async function main() {
  const { target, dry, onrails, mode } = parseArgs(Bun.argv.slice(2));
  const codeChanges: FileChange[] = [];
  const pkgChanges: PkgChange[] = [];
  for await (const file of walk(target)) {
    if (mode === "compat" && file.endsWith("/package.json")) {
      await rewritePkg(file, onrails, dry).match(
        (m) =>
          matchMaybe(
            m,
            (c) => void pkgChanges.push(c),
            () => undefined,
          ),
        (e) => console.error(`error processing ${file}:`, e.message),
      );
    } else if (CODE_EXT.test(file)) {
      await rewriteCode(file, dry, mode).match(
        (m) =>
          matchMaybe(
            m,
            (c) => void codeChanges.push(c),
            () => undefined,
          ),
        (e) => console.error(`error processing ${file}:`, e.message),
      );
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
