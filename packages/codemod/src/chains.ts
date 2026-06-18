import { compactMap, isSome, type Maybe, map, none, some } from "@onrails/maybe";
import { match } from "@onrails/pattern";
import ts from "typescript";
import { argsToText, edit, lookupMap, spanEdit, walkSource } from "./ast.js";
import {
  ASYNC_ROOT_HINTS,
  CHAIN_METHODS,
  PREDICATE_METHODS,
  RESULT_SPECIFIC_CHAIN_METHODS,
  SAFE_BASE_PATTERNS,
  TEE_METHODS,
  TERMINAL_METHODS,
  UNSAFE_UNWRAP_METHODS,
  ZERO_ARG_HELPERS,
} from "./constants.js";
import { addNativeValueImports } from "./imports.js";
import type { ChainStep, Edit, EditAcc, PipelinePart } from "./types.js";

export function isSupportedChainCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isPropertyAccessExpression(node.expression)) return false;
  const method = node.expression.name.text;
  return CHAIN_METHODS.has(method) || TERMINAL_METHODS.has(method);
}

const HELPERS = [
  "sequenceTupleAsync",
  "getOrElse",
  "collect",
  "matchResult",
  "matchMaybe",
  "fold",
] as const;

type HelperName = (typeof HELPERS)[number];

function isHelperName(x: string): x is HelperName {
  return (HELPERS as readonly string[]).includes(x);
}

function identifierCallToNative(node: ts.CallExpression): Maybe<Edit> {
  if (!ts.isIdentifier(node.expression)) return none();
  const name = node.expression.text;
  if (node.arguments.length === 0) {
    const zero = lookupMap(ZERO_ARG_HELPERS, name, (text) => edit(text));
    if (isSome(zero)) return zero;
  }

  if (!isHelperName(name)) {
    return none();
  }

  return match(name)
    .with("sequenceTupleAsync", () =>
      some(edit(`ResultAsync.combineTuple(${argsToText(node.arguments)})`, ["ResultAsync"])),
    )
    .with("getOrElse", () => some(edit(`unwrapOr(${argsToText(node.arguments)})`, ["unwrapOr"])))
    .with("collect", () => some(edit(`combine(${argsToText(node.arguments)})`, ["combine"])))
    .withOneOf(["matchResult", "matchMaybe"], () =>
      some(edit(`match(${argsToText(node.arguments)})`, ["match"])),
    )
    .with("fold", () =>
      map(foldHandlerTexts(node.arguments[0]), ({ okText, errText }) =>
        edit(`match(${okText}, ${errText})`, ["match"]),
      ),
    )
    .exhaustive();
}

type FoldHandlerTexts = { okText: string; errText: string };

// Bails (none) unless both `ok` and `err` handlers are plain or shorthand
// properties — spread/computed handlers can't be rewritten textually.
function foldHandlerTexts(objArg: ts.Expression | undefined): Maybe<FoldHandlerTexts> {
  if (!objArg || !ts.isObjectLiteralExpression(objArg)) return none();
  let okText: string | undefined;
  let errText: string | undefined;
  for (const prop of objArg.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      if (prop.name.text === "ok") {
        okText = prop.initializer.getText();
      } else if (prop.name.text === "err") {
        errText = prop.initializer.getText();
      }
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      if (prop.name.text === "ok") {
        okText = "ok";
      } else if (prop.name.text === "err") {
        errText = "err";
      }
    }
  }
  return okText !== undefined && errText !== undefined ? some({ okText, errText }) : none();
}

function curriedFoldToNative(node: ts.CallExpression): Maybe<Edit> {
  if (
    !ts.isCallExpression(node.expression) ||
    !ts.isIdentifier(node.expression.expression) ||
    node.expression.expression.text !== "fold"
  ) {
    return none();
  }
  const receiver = node.arguments[0];
  return !receiver
    ? none()
    : map(foldHandlerTexts(node.expression.arguments[0]), ({ okText, errText }) =>
        edit(`match(${okText}, ${errText})(${receiver.getText()})`, ["match"]),
      );
}

export function helperCallToNative(node: ts.CallExpression): Maybe<Edit> {
  const ident = identifierCallToNative(node);
  if (isSome(ident)) return ident;

  const curried = curriedFoldToNative(node);
  if (isSome(curried)) return curried;

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

export function isNestedInSupportedChain(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (!ts.isPropertyAccessExpression(parent)) return false;
  return isSupportedChainCall(parent.parent);
}

export function collectChain(node: ts.CallExpression): { base: string; steps: ChainStep[] } {
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

export const hasAsyncRootHint = (base: string): boolean =>
  ASYNC_ROOT_HINTS.some((hint) => base.includes(hint));

export const isSafeSyncChainBase = (base: string): boolean =>
  SAFE_BASE_PATTERNS.some((re) => re.test(base));

const isTerminalStep = (s: ChainStep): boolean => TERMINAL_METHODS.has(s.method);
const isResultSpecificStep = (s: ChainStep): boolean => RESULT_SPECIFIC_CHAIN_METHODS.has(s.method);
const isChainStep = (s: ChainStep): boolean => CHAIN_METHODS.has(s.method);

export function chainToNative(base: string, steps: readonly ChainStep[]): Maybe<Edit> {
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

export const byStartDesc = (a: Edit, b: Edit): number => b.start - a.start;

export const applyEditStep = (acc: EditAcc, e: Edit): EditAcc => ({
  src: `${acc.src.slice(0, e.start)}${e.text}${acc.src.slice(e.end)}`,
  imports: new Set([...acc.imports, ...e.imports]),
});

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
