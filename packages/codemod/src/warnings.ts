import ts from "typescript";
import { walkSource } from "./ast.js";
import { COMPAT_ONLY_PATTERNS, COMPAT_SPEC } from "./constants.js";
import type { Warning } from "./types.js";

export const collectRegexLineWarnings = (src: string): readonly Warning[] =>
  src
    .split(/\r?\n/)
    .flatMap((line, i) =>
      COMPAT_ONLY_PATTERNS.flatMap(({ pattern, label }) =>
        pattern.test(line) ? [{ line: i + 1, label, text: line.trim() }] : [],
      ),
    );

export const collectAstCompatWarnings = (src: string, jsx = false): readonly Warning[] => {
  const warnings: Warning[] = [];
  const lines = src.split(/\r?\n/);
  const lineTextAt = (sf: ts.SourceFile, node: ts.Node) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    return { line, text: lines[line - 1]?.trim() ?? node.getText(sf) };
  };

  walkSource(
    src,
    (node, sf) => {
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
    },
    jsx,
  );

  return warnings;
};

export const collectNativeMigrationWarnings = (src: string, jsx = false): readonly Warning[] => [
  ...collectRegexLineWarnings(src),
  ...collectAstCompatWarnings(src, jsx),
];

export const collectUnsupportedCompatImportWarnings = (src: string): readonly Warning[] =>
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
