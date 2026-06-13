import { fromNullable, type Maybe, match, none, some } from "@onrails/maybe";
import ts from "typescript";
import { TYPE_ONLY_NATIVE } from "./constants.js";
import type { Edit } from "./types.js";

export const edit = (text: string, imports: readonly string[] = []): Edit => ({
  start: 0,
  end: 0,
  text,
  imports,
});

export const lookupMap = <K, V, R>(m: Map<K, V>, k: K, f: (v: V) => R): Maybe<R> =>
  match(fromNullable(m.get(k)), (v) => some(f(v)), none);

export const concatCollectors =
  <T, R>(...fns: Array<(t: T) => readonly R[]>) =>
  (t: T): readonly R[] =>
    fns.flatMap((f) => f(t));

export const walkSource = (
  src: string,
  visit: (node: ts.Node, sf: ts.SourceFile) => unknown,
): void => {
  const sf = ts.createSourceFile("codemod.ts", src, ts.ScriptTarget.Latest, true);
  const go = (n: ts.Node) => {
    if (visit(n, sf)) return;
    ts.forEachChild(n, go);
  };
  go(sf);
};

export const spanEdit = (node: ts.Node, sf: ts.SourceFile, partial: Edit): Edit => ({
  ...partial,
  start: node.getStart(sf),
  end: node.getEnd(),
});

export const argsToText = (args: ts.NodeArray<ts.Expression>): string =>
  args.map((a) => a.getText()).join(", ");

export const countOccurrences = (s: string, sub: string): number => s.split(sub).length - 1;

export const splitImportNames = (specifiers: string): readonly string[] =>
  specifiers
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const stripInlineType = (specifier: string): string => specifier.replace(/^type\s+/, "");

export const importedName = (specifier: string): string =>
  stripInlineType(specifier).split(/\s+as\s+/i)[0] ?? specifier;

export const isTypeOnlyNative = (specifier: string): boolean =>
  specifier.startsWith("type ") || TYPE_ONLY_NATIVE.has(importedName(specifier));

export const isValueImport = (specifier: string): boolean => !isTypeOnlyNative(specifier);
