import ts from "typescript";
import type { Edit } from "./types.js";

interface Comparison {
  target: ts.Expression;
  literal: ts.Expression;
}

function getComparison(node: ts.Expression): Comparison | undefined {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
  ) {
    const left = node.left;
    const right = node.right;
    const isLit = (n: ts.Expression) =>
      ts.isLiteralExpression(n) ||
      n.kind === ts.SyntaxKind.TrueKeyword ||
      n.kind === ts.SyntaxKind.FalseKeyword ||
      n.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(n) && n.text === "undefined");

    if (isLit(left)) {
      return { target: right, literal: left };
    }
    if (isLit(right)) {
      return { target: left, literal: right };
    }
  }
  return undefined;
}

function getComparisons(node: ts.Expression, list: Comparison[] = []): Comparison[] | undefined {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    const left = getComparisons(node.left, list);
    if (!left) return undefined;
    const right = getComparisons(node.right, list);
    return !right ? undefined : list;
  }
  const comp = getComparison(node);
  if (comp) {
    list.push(comp);
    return list;
  }
  return undefined;
}

function isSimpleTarget(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) {
    return true;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return isSimpleTarget(node.expression);
  }
  return false;
}

function endsWithReturn(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement)) {
    return true;
  }
  if (ts.isBlock(statement)) {
    const last = statement.statements[statement.statements.length - 1];
    return last ? endsWithReturn(last) : false;
  }
  return false;
}

function getLinePrefix(pos: number, sf: ts.SourceFile): string {
  const lineStarts = sf.getLineStarts();
  const { line } = ts.getLineAndCharacterOfPosition(sf, pos);
  const lineStart = lineStarts[line];
  if (lineStart === undefined) return "";
  const lineText = sf.text.slice(lineStart, pos);
  const match = /^[ \t]+$/.exec(lineText);
  return match ? lineText : "";
}

interface SwitchSequence {
  seq: ts.IfStatement[];
  targetText: string;
}

function findSwitchSequence(
  statements: readonly ts.Statement[],
  startIndex: number,
  sf: ts.SourceFile,
): SwitchSequence | undefined {
  const seq: ts.IfStatement[] = [];
  let targetText: string | undefined;

  let j = startIndex;
  while (j < statements.length) {
    const s = statements[j];
    if (!s || !ts.isIfStatement(s) || s.elseStatement) {
      break;
    }
    const comps = getComparisons(s.expression, []);
    if (!comps || comps.length === 0) {
      break;
    }
    const target = comps[0]?.target;
    if (!target || !isSimpleTarget(target)) {
      break;
    }
    const tText = target.getText(sf);
    if (targetText === undefined) {
      targetText = tText;
    } else if (targetText !== tText) {
      break;
    }
    const allSame = comps.every((c) => c.target.getText(sf) === targetText);
    if (!allSame) {
      break;
    }

    seq.push(s);
    j++;
  }

  return seq.length >= 3 && targetText !== undefined ? { seq, targetText } : undefined;
}

function buildSwitchStatement(
  seq: readonly ts.IfStatement[],
  targetText: string,
  prefix: string,
  sf: ts.SourceFile,
): string {
  let switchText = `switch (${targetText}) {\n`;
  for (const s of seq) {
    const comps = getComparisons(s.expression, []);
    if (comps) {
      for (const c of comps) {
        switchText += `${prefix}  case ${c.literal.getText(sf)}:\n`;
      }
    }
    let bodyText = "";
    if (ts.isBlock(s.thenStatement)) {
      bodyText = s.thenStatement.statements
        .map((stmt) => {
          const stmtPrefix = getLinePrefix(stmt.getStart(sf), sf);
          return stmt
            .getText(sf)
            .split("\n")
            .map((line) =>
              line.startsWith(stmtPrefix)
                ? `${prefix}    ${line.slice(stmtPrefix.length)}`
                : `${prefix}    ${line.trimStart()}`,
            )
            .join("\n");
        })
        .join("\n");
    } else {
      const stmtPrefix = getLinePrefix(s.thenStatement.getStart(sf), sf);
      bodyText = s.thenStatement
        .getText(sf)
        .split("\n")
        .map((line) =>
          line.startsWith(stmtPrefix)
            ? `${prefix}    ${line.slice(stmtPrefix.length)}`
            : `${prefix}    ${line.trimStart()}`,
        )
        .join("\n");
    }
    switchText += `${bodyText}\n`;
    if (!endsWithReturn(s.thenStatement)) {
      switchText += `${prefix}    break;\n`;
    }
  }
  switchText += `${prefix}}`;
  return switchText;
}

export function scanIfToSwitchSequences(
  node: ts.Node,
  sf: ts.SourceFile,
  skippedNodes: Set<ts.Node>,
  edits: Edit[],
): void {
  if (ts.isBlock(node) || ts.isSourceFile(node)) {
    const statements = node.statements;
    let i = 0;
    while (i < statements.length) {
      const result = findSwitchSequence(statements, i, sf);
      if (result) {
        const { seq, targetText } = result;
        const firstSeq = seq[0];
        const lastSeq = seq[seq.length - 1];
        if (firstSeq && lastSeq) {
          const prefix = getLinePrefix(firstSeq.getStart(sf), sf);
          const switchText = buildSwitchStatement(seq, targetText, prefix, sf);

          for (const s of seq) {
            skippedNodes.add(s);
          }
          edits.push({
            start: firstSeq.getStart(sf),
            end: lastSeq.getEnd(),
            text: switchText,
            imports: [],
          });
          i += seq.length - 1;
        }
      }
      i++;
    }
  }
}
