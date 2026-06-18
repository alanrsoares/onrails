import { type Maybe, none, some } from "@onrails/maybe";
import ts from "typescript";
import { edit, spanEdit, walkSource } from "./ast.js";
import { applyEditStep, byStartDesc } from "./chains.js";
import { scanIfToSwitchSequences } from "./switch.js";
import type { Edit } from "./types.js";

// Helper to check for single statement return
function getSingleReturnExpression(statement: ts.Statement): ts.Expression | undefined {
  if (ts.isReturnStatement(statement)) {
    return statement.expression;
  }
  if (ts.isBlock(statement)) {
    if (statement.statements.length === 1) {
      const single = statement.statements[0];
      if (single && ts.isReturnStatement(single)) {
        return single.expression;
      }
    }
  }
  return undefined;
}

// Helper to check if body uses 'this' or 'arguments'
function usesThisOrArguments(body: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (n.kind === ts.SyntaxKind.ThisKeyword) {
      found = true;
      return;
    }
    if (ts.isIdentifier(n) && n.text === "arguments") {
      found = true;
      return;
    }
    if (
      ts.isFunctionDeclaration(n) ||
      ts.isFunctionExpression(n) ||
      ts.isArrowFunction(n) ||
      ts.isMethodDeclaration(n) ||
      ts.isGetAccessorDeclaration(n) ||
      ts.isSetAccessorDeclaration(n)
    ) {
      return; // Stop recursion for nested scopes
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(body, visit);
  return found;
}

// Helper to check if identifier referenced before pos
function isIdentifierReferencedBefore(name: string, pos: number, sf: ts.SourceFile): boolean {
  let referenced = false;
  const visit = (n: ts.Node) => {
    if (referenced) return;
    if (n.getStart(sf) >= pos) return;
    if (ts.isIdentifier(n) && n.text === name) {
      const parent = n.parent;
      if (parent) {
        if (ts.isPropertyAccessExpression(parent) && parent.name === n) {
          return;
        }
        if (ts.isPropertyAssignment(parent) && parent.name === n) {
          return;
        }
        if (ts.isMethodDeclaration(parent) && parent.name === n) {
          return;
        }
        if (ts.isPropertyDeclaration(parent) && parent.name === n) {
          return;
        }
        if (ts.isBindingElement(parent) && parent.propertyName === n) {
          return;
        }
      }
      referenced = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return referenced;
}

function getTypeParametersText(
  node: ts.FunctionDeclaration | ts.FunctionExpression,
  sf: ts.SourceFile,
): string {
  if (node.typeParameters && node.typeParameters.length > 0) {
    const params = node.typeParameters.map((p) => p.getText(sf));
    return params.length === 1 ? `<${params[0]},>` : `<${params.join(", ")}>`;
  }
  return "";
}

const isSimpleExpression = (expr: ts.Expression): boolean =>
  ts.isIdentifier(expr) ||
  ts.isPropertyAccessExpression(expr) ||
  ts.isElementAccessExpression(expr) ||
  ts.isCallExpression(expr);

function containsConditional(node: ts.Node): boolean {
  if (ts.isConditionalExpression(node)) {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (found) return;
    if (containsConditional(child)) {
      found = true;
    }
  });
  return found;
}

function tryTersifyIfElse(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isIfStatement(node) && node.elseStatement) {
    const x = getSingleReturnExpression(node.thenStatement);
    const y = getSingleReturnExpression(node.elseStatement);
    if (x && y) {
      if (containsConditional(x) || containsConditional(y)) {
        return none();
      }
      const condText = node.expression.getText(sf);
      const xIsTrue = x.kind === ts.SyntaxKind.TrueKeyword;
      const xIsFalse = x.kind === ts.SyntaxKind.FalseKeyword;
      const yIsTrue = y.kind === ts.SyntaxKind.TrueKeyword;
      const yIsFalse = y.kind === ts.SyntaxKind.FalseKeyword;

      if (xIsTrue && yIsFalse) {
        return some(spanEdit(node, sf, edit(`return ${condText};`)));
      }
      if (xIsFalse && yIsTrue) {
        const needsParens = !isSimpleExpression(node.expression);
        const text = needsParens ? `return !(${condText});` : `return !${condText};`;
        return some(spanEdit(node, sf, edit(text)));
      }

      const xText = x.getText(sf);
      const yText = y.getText(sf);
      return some(spanEdit(node, sf, edit(`return ${condText} ? ${xText} : ${yText};`)));
    }
  }
  return none();
}

// A concise arrow body that is — or unwraps through `as` / `satisfies` to — an
// object literal must be parenthesized, else `{ … }` parses as a block body.
function startsWithObjectLiteral(expr: ts.Expression): boolean {
  let e: ts.Expression = expr;
  while (ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) {
    e = e.expression;
  }
  return ts.isObjectLiteralExpression(e);
}

function tryTersifyArrowBlock(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isArrowFunction(node) && ts.isBlock(node.body)) {
    const expr = getSingleReturnExpression(node.body);
    if (expr) {
      const exprText = expr.getText(sf);
      const text = startsWithObjectLiteral(expr) ? `(${exprText})` : exprText;
      return some(spanEdit(node.body, sf, edit(text)));
    }
  }
  return none();
}

function tryTersifyFunctionExpression(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isFunctionExpression(node) && !node.name && !node.asteriskToken) {
    const expr = getSingleReturnExpression(node.body);
    if (expr && !usesThisOrArguments(node.body)) {
      const asyncKeyword = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
        ? "async "
        : "";
      const typeParamsText = getTypeParametersText(node, sf);
      const paramsText = node.parameters.map((p) => p.getText(sf)).join(", ");
      const returnType = node.type ? `: ${node.type.getText(sf)}` : "";
      const exprText = expr.getText(sf);
      const bodyText = startsWithObjectLiteral(expr) ? `(${exprText})` : exprText;
      const text = `${asyncKeyword}${typeParamsText}(${paramsText})${returnType} => ${bodyText}`;
      return some(spanEdit(node, sf, edit(text)));
    }
  }
  return none();
}

function tryTersifyFunctionDeclaration(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isFunctionDeclaration(node) && node.name && node.body && !node.asteriskToken) {
    const isDefault = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (!isDefault) {
      const expr = getSingleReturnExpression(node.body);
      if (expr && !usesThisOrArguments(node.body)) {
        const nameText = node.name.getText(sf);
        if (!isIdentifierReferencedBefore(nameText, node.getStart(sf), sf)) {
          const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
          const asyncKeyword = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
            ? "async "
            : "";
          const typeParamsText = getTypeParametersText(node, sf);
          const paramsText = node.parameters.map((p) => p.getText(sf)).join(", ");
          const returnType = node.type ? `: ${node.type.getText(sf)}` : "";
          const exprText = expr.getText(sf);
          const bodyText = startsWithObjectLiteral(expr) ? `(${exprText})` : exprText;
          const exportPrefix = isExported ? "export " : "";
          const text = `${exportPrefix}const ${nameText} = ${asyncKeyword}${typeParamsText}(${paramsText})${returnType} => ${bodyText};`;
          return some(spanEdit(node, sf, edit(text)));
        }
      }
    }
  }
  return none();
}

function tryTersifyPropertyAssignment(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isPropertyAssignment(node)) {
    if (
      ts.isIdentifier(node.name) &&
      ts.isIdentifier(node.initializer) &&
      node.name.text === node.initializer.text
    ) {
      return some(spanEdit(node, sf, edit(node.name.text)));
    }
  }
  return none();
}

function tryTersifyNoSubstitutionTemplateLiteral(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.parent && ts.isTaggedTemplateExpression(node.parent)) {
      return none();
    }
    const rawText = node.getText(sf);
    const content = rawText.slice(1, -1);
    if (!content.includes("\n") && !content.includes("\r") && !content.includes('"')) {
      return some(spanEdit(node, sf, edit(`"${content}"`)));
    }
  }
  return none();
}

function tryTersifyIdentityFilter(node: ts.Node, sf: ts.SourceFile): Maybe<Edit> {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (node.parameters.length === 1) {
      const param = node.parameters[0];
      if (param && ts.isIdentifier(param.name)) {
        const paramName = param.name.text;
        const body = node.body;
        const expr = ts.isBlock(body) ? getSingleReturnExpression(body) : body;

        if (expr) {
          const isDirectIdentity = ts.isIdentifier(expr) && expr.text === paramName;
          let isDoubleNegatedIdentity = false;
          if (
            ts.isPrefixUnaryExpression(expr) &&
            expr.operator === ts.SyntaxKind.ExclamationToken &&
            ts.isPrefixUnaryExpression(expr.operand) &&
            expr.operand.operator === ts.SyntaxKind.ExclamationToken &&
            ts.isIdentifier(expr.operand.operand) &&
            expr.operand.operand.text === paramName
          ) {
            isDoubleNegatedIdentity = true;
          }

          if (isDirectIdentity || isDoubleNegatedIdentity) {
            const parent = node.parent;
            if (
              parent &&
              ts.isCallExpression(parent) &&
              parent.arguments.includes(node as ts.Expression)
            ) {
              if (ts.isPropertyAccessExpression(parent.expression)) {
                const method = parent.expression.name.text;
                if (
                  method === "filter" ||
                  method === "some" ||
                  method === "every" ||
                  method === "find"
                ) {
                  return some(spanEdit(node, sf, edit("Boolean")));
                }
              }
            }
          }
        }
      }
    }
  }
  return none();
}

function tryTersifyOptionalChainGuard(
  stmt: ts.IfStatement,
  nextStmt: ts.ReturnStatement,
  sf: ts.SourceFile,
): Maybe<Edit> {
  const firstStmt = ts.isBlock(stmt.thenStatement) ? stmt.thenStatement.statements[0] : undefined;
  const isThenEmptyReturn =
    (ts.isReturnStatement(stmt.thenStatement) && !stmt.thenStatement.expression) ||
    (ts.isBlock(stmt.thenStatement) &&
      stmt.thenStatement.statements.length === 1 &&
      firstStmt &&
      ts.isReturnStatement(firstStmt) &&
      !firstStmt.expression);

  if (
    isThenEmptyReturn &&
    ts.isPrefixUnaryExpression(stmt.expression) &&
    stmt.expression.operator === ts.SyntaxKind.ExclamationToken &&
    nextStmt.expression &&
    ts.isPropertyAccessExpression(nextStmt.expression)
  ) {
    const target = stmt.expression.operand;
    const accessExpr = nextStmt.expression;
    if (accessExpr.expression.getText(sf) === target.getText(sf)) {
      const targetText = target.getText(sf);
      const propName = accessExpr.name.getText(sf);
      const text = `return ${targetText}?.${propName};`;
      return some({
        start: stmt.getStart(sf),
        end: nextStmt.getEnd(),
        text,
        imports: [],
      });
    }
  }
  return none();
}

function tryTersifyTernaryOrBooleanSequence(
  stmt: ts.IfStatement,
  nextStmt: ts.ReturnStatement,
  sf: ts.SourceFile,
): Maybe<Edit> {
  const x = getSingleReturnExpression(stmt.thenStatement);
  const y = nextStmt.expression;
  if (x && y) {
    if (containsConditional(x) || containsConditional(y)) {
      return none();
    }
    const condText = stmt.expression.getText(sf);
    const xIsTrue = x.kind === ts.SyntaxKind.TrueKeyword;
    const xIsFalse = x.kind === ts.SyntaxKind.FalseKeyword;
    const yIsTrue = y.kind === ts.SyntaxKind.TrueKeyword;
    const yIsFalse = y.kind === ts.SyntaxKind.FalseKeyword;

    let text = "";
    if (xIsTrue && yIsFalse) {
      text = `return ${condText};`;
    } else if (xIsFalse && yIsTrue) {
      const needsParens = !isSimpleExpression(stmt.expression);
      text = needsParens ? `return !(${condText});` : `return !${condText};`;
    } else {
      const xText = x.getText(sf);
      const yText = y.getText(sf);
      text = `return ${condText} ? ${xText} : ${yText};`;
    }

    return some({
      start: stmt.getStart(sf),
      end: nextStmt.getEnd(),
      text,
      imports: [],
    });
  }
  return none();
}

function scanIfReturnSequences(
  node: ts.Node,
  sf: ts.SourceFile,
  skippedNodes: Set<ts.Node>,
  edits: Edit[],
): void {
  if (ts.isBlock(node) || ts.isSourceFile(node)) {
    const statements = node.statements;
    for (let i = 0; i < statements.length - 1; i++) {
      const stmt = statements[i];
      const nextStmt = statements[i + 1];
      if (
        stmt &&
        nextStmt &&
        ts.isIfStatement(stmt) &&
        !stmt.elseStatement &&
        ts.isReturnStatement(nextStmt)
      ) {
        // If this IfStatement is part of a sequence of IfStatements, do not convert it.
        // We detect this by checking if the previous statement is also an IfStatement.
        const prev = statements[i - 1];
        if (prev && ts.isIfStatement(prev)) {
          continue;
        }

        const optChainEdit = tryTersifyOptionalChainGuard(stmt, nextStmt, sf);
        if (optChainEdit._tag === "Some") {
          skippedNodes.add(stmt);
          skippedNodes.add(nextStmt);
          edits.push(optChainEdit.value);
          continue;
        }

        const seqEdit = tryTersifyTernaryOrBooleanSequence(stmt, nextStmt, sf);
        if (seqEdit._tag === "Some") {
          skippedNodes.add(stmt);
          skippedNodes.add(nextStmt);
          edits.push(seqEdit.value);
        }
      }
    }
  }
}

const TRANSFORMS: ReadonlyArray<(node: ts.Node, sf: ts.SourceFile) => Maybe<Edit>> = [
  tryTersifyIfElse,
  tryTersifyArrowBlock,
  tryTersifyFunctionExpression,
  tryTersifyFunctionDeclaration,
  tryTersifyPropertyAssignment,
  tryTersifyNoSubstitutionTemplateLiteral,
  tryTersifyIdentityFilter,
];

function tersifyOnce(src: string): string {
  const edits: Edit[] = [];
  const skippedNodes = new Set<ts.Node>();

  walkSource(src, (node, sf) => {
    if (skippedNodes.has(node)) {
      return true;
    }

    scanIfReturnSequences(node, sf, skippedNodes, edits);
    scanIfToSwitchSequences(node, sf, skippedNodes, edits);

    for (const transform of TRANSFORMS) {
      const editResult = transform(node, sf);
      if (editResult._tag === "Some") {
        edits.push(editResult.value);
        skippedNodes.add(node);
        return true;
      }
    }

    return false;
  });

  if (edits.length === 0) return src;

  const { src: next } = edits
    .sort(byStartDesc)
    .reduce(applyEditStep, { src, imports: new Set<string>() });

  return next;
}

export function tersify(src: string): string {
  let current = src;
  let iterations = 0;
  while (iterations < 10) {
    const next = tersifyOnce(current);
    if (next === current) {
      break;
    }
    current = next;
    iterations++;
  }
  return current;
}
