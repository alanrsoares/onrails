import ts from "typescript";

// Helper to check for single statement return
export function getSingleReturnExpression(statement: ts.Statement): ts.Expression | undefined {
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
export function usesThisOrArguments(body: ts.Node): boolean {
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
export function isIdentifierReferencedBefore(
  name: string,
  pos: number,
  sf: ts.SourceFile,
): boolean {
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

export function getTypeParametersText(
  node: ts.FunctionDeclaration | ts.FunctionExpression,
  sf: ts.SourceFile,
): string {
  if (node.typeParameters && node.typeParameters.length > 0) {
    const params = node.typeParameters.map((p) => p.getText(sf));
    return params.length === 1 ? `<${params[0]},>` : `<${params.join(", ")}>`;
  }
  return "";
}

export const isSimpleExpression = (expr: ts.Expression): boolean =>
  ts.isIdentifier(expr) ||
  ts.isPropertyAccessExpression(expr) ||
  ts.isElementAccessExpression(expr) ||
  ts.isCallExpression(expr);

export function containsConditional(node: ts.Node): boolean {
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

// A concise arrow body that is — or unwraps through `as` / `satisfies` to — an
// object literal must be parenthesized, else `{ … }` parses as a block body.
export function startsWithObjectLiteral(expr: ts.Expression): boolean {
  let e: ts.Expression = expr;
  while (ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) {
    e = e.expression;
  }
  return ts.isObjectLiteralExpression(e);
}

export function getTernaryBranchText(node: ts.Expression, sf: ts.SourceFile): string {
  let current = node;
  let hasParens = false;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
    hasParens = true;
  }

  let unwrapped: ts.Expression | undefined;
  if (ts.isJsxFragment(current)) {
    const children = current.children;
    const nonTriviaChildren = children.filter((child) => {
      if (ts.isJsxText(child)) {
        return !child.containsOnlyTriviaWhiteSpaces;
      }
      return true;
    });
    if (nonTriviaChildren.length === 1) {
      const soleChild = nonTriviaChildren[0];
      if (soleChild && ts.isJsxExpression(soleChild) && soleChild.expression) {
        unwrapped = soleChild.expression;
      }
    }
  } else if (ts.isJsxElement(current)) {
    const tagName = current.openingElement.tagName.getText(sf);
    if (tagName === "Fragment" || tagName === "React.Fragment" || tagName.endsWith(".Fragment")) {
      if (current.openingElement.attributes.properties.length === 0) {
        const children = current.children;
        const nonTriviaChildren = children.filter((child) => {
          if (ts.isJsxText(child)) {
            return !child.containsOnlyTriviaWhiteSpaces;
          }
          return true;
        });
        if (nonTriviaChildren.length === 1) {
          const soleChild = nonTriviaChildren[0];
          if (soleChild && ts.isJsxExpression(soleChild) && soleChild.expression) {
            unwrapped = soleChild.expression;
          }
        }
      }
    }
  }

  if (unwrapped) {
    const unwrappedText = getTernaryBranchText(unwrapped, sf);
    return hasParens ? `(${unwrappedText})` : unwrappedText;
  }

  return node.getText(sf);
}
