import ts from "typescript6";
import { walkSource } from "./ast.js";
import { NATIVE_SPEC } from "./constants.js";

const MAYBE_SPEC = "@onrails/maybe";

type Shape = { readonly fn: string; readonly spec: string; readonly field: string | null };

const SHAPES: Record<string, Shape> = {
  Ok: { fn: "ok", spec: NATIVE_SPEC, field: "value" },
  Err: { fn: "err", spec: NATIVE_SPEC, field: "error" },
  Some: { fn: "some", spec: MAYBE_SPEC, field: "value" },
  None: { fn: "none", spec: MAYBE_SPEC, field: null },
};

type Prop = { readonly key: string; readonly text: string };
type LiteralEdit = { start: number; end: number; text: string; name: string; spec: string };

const keyOf = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;

/** `key: value` / `key` shorthand pairs; null when a spread, method, accessor or computed key is present. */
const readProps = (lit: ts.ObjectLiteralExpression): readonly Prop[] | null => {
  const props: Prop[] = [];
  for (const p of lit.properties) {
    if (ts.isPropertyAssignment(p)) {
      const key = keyOf(p.name);
      if (key === null) return null;
      props.push({ key, text: p.initializer.getText() });
    } else if (ts.isShorthandPropertyAssignment(p)) {
      props.push({ key: p.name.text, text: p.name.text });
    } else return null;
  }
  return props;
};

const tagOf = (props: readonly Prop[]): string | undefined => {
  const raw = props.find((p) => p.key === "_tag")?.text;
  return raw?.match(/^(["'])(\w+)\1$/)?.[2];
};

const bindingNames = (name: ts.BindingName): readonly string[] =>
  ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : bindingNames(el.name)));

const declaredIn = (statements: readonly ts.Statement[]): readonly string[] =>
  statements.flatMap((st) => {
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name)
      return [st.name.text];
    if (ts.isVariableStatement(st)) {
      return st.declarationList.declarations.flatMap((d) => bindingNames(d.name));
    }
    return [];
  });

/** The genuine value binding of an onrails constructor: `import { ok }` with no alias, not type-only. */
const isPlainValueSpecifier = (el: ts.ImportSpecifier, clauseTypeOnly: boolean): boolean =>
  !clauseTypeOnly && !el.isTypeOnly && el.propertyName === undefined;

/** Locals the file's imports bind to something other than the onrails constructor of the same name. */
const importedLocals = (sf: ts.SourceFile): readonly string[] =>
  sf.statements.flatMap((st) => {
    if (!ts.isImportDeclaration(st)) return [];
    const spec = ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : "";
    const onrails = spec === NATIVE_SPEC || spec === MAYBE_SPEC;
    const clause = st.importClause;
    const nb = clause?.namedBindings;
    const named =
      nb && ts.isNamedImports(nb)
        ? nb.elements.filter(
            (el) => !onrails || !isPlainValueSpecifier(el, clause?.isTypeOnly ?? false),
          )
        : [];
    return [
      ...(clause?.name ? [clause.name.text] : []),
      ...(nb && ts.isNamespaceImport(nb) ? [nb.name.text] : []),
      ...named.map((el) => el.name.text),
    ];
  });

/** `var` names declared anywhere under `root`, stopping at nested functions (they hoist to those). */
const hoistedVars = (root: ts.Node): readonly string[] => {
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionLike(n) || ts.isClassLike(n)) return;
    if (ts.isVariableDeclarationList(n) && !(n.flags & ts.NodeFlags.BlockScoped)) {
      for (const d of n.declarations) out.push(...bindingNames(d.name));
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(root, (child) => {
    // the function's own parameters and name are not `var`s; its body is
    if (!ts.isFunctionLike(root) || child === (root as ts.FunctionLikeDeclaration).body)
      visit(child);
  });
  return out;
};

/** Names a single scope-creating node binds for the code inside it. */
const boundBy = (node: ts.Node): readonly string[] => {
  if (ts.isSourceFile(node)) {
    return [...importedLocals(node), ...declaredIn(node.statements), ...hoistedVars(node)];
  }
  if (ts.isBlock(node) || ts.isModuleBlock(node)) return declaredIn(node.statements);
  if (ts.isCaseBlock(node)) return declaredIn(node.clauses.flatMap((c) => [...c.statements]));
  if (ts.isCatchClause(node)) {
    return node.variableDeclaration ? bindingNames(node.variableDeclaration.name) : [];
  }
  if (
    (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer)
  ) {
    return node.initializer.declarations.flatMap((d) => bindingNames(d.name));
  }
  if (ts.isFunctionLike(node)) {
    const own =
      (ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name
        ? [node.name.text]
        : [];
    return [...own, ...node.parameters.flatMap((p) => bindingNames(p.name)), ...hoistedVars(node)];
  }
  return [];
};

/** True when `name` resolves to a non-onrails binding at `node` (walks every enclosing scope). */
const isShadowed = (node: ts.Node, name: string): boolean => {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (boundBy(cur).includes(name)) return true;
  }
  return false;
};

/** The node to replace: the literal, widened over a trailing `as const` that the call makes redundant. */
const spanNode = (lit: ts.ObjectLiteralExpression): ts.Node =>
  ts.isAsExpression(lit.parent) &&
  ts.isTypeReferenceNode(lit.parent.type) &&
  lit.parent.type.typeName.getText() === "const"
    ? lit.parent
    : lit;

const collectEdits = (src: string, jsx: boolean): readonly LiteralEdit[] => {
  const edits: LiteralEdit[] = [];
  walkSource(
    src,
    (node, sf) => {
      if (!ts.isObjectLiteralExpression(node)) return false;
      const props = readProps(node);
      const tag = props && tagOf(props);
      const shape = tag ? SHAPES[tag] : undefined;
      if (!props || !shape || (shape && isShadowed(node, shape.fn))) return false;
      const wanted = shape.field === null ? ["_tag"] : ["_tag", shape.field];
      const keys = props.map((p) => p.key);
      if (keys.length !== wanted.length || !wanted.every((k) => keys.includes(k))) return false;
      const arg =
        shape.field === null ? "" : (props.find((p) => p.key === shape.field)?.text ?? "");
      const span = spanNode(node);
      edits.push({
        start: span.getStart(sf),
        end: span.getEnd(),
        text: `${shape.fn}(${arg})`,
        name: shape.fn,
        spec: shape.spec,
      });
      // outermost only; nested literals are picked up on the next pass
      return true;
    },
    jsx,
  );
  return edits;
};

const matchingImports = (sf: ts.SourceFile, spec: string): readonly ts.ImportDeclaration[] =>
  sf.statements.filter(
    (st): st is ts.ImportDeclaration =>
      ts.isImportDeclaration(st) &&
      ts.isStringLiteral(st.moduleSpecifier) &&
      st.moduleSpecifier.text === spec &&
      !st.importClause?.isTypeOnly &&
      st.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(st.importClause.namedBindings),
  );

/**
 * Merges `names` into a value import of `spec` (found through the parser), or inserts one after any
 * shebang. A name counts as present only when a plain, unaliased, non-type specifier binds it locally.
 */
const addImports = (src: string, spec: string, names: readonly string[]): string => {
  const wanted = [...new Set(names)].sort();
  if (wanted.length === 0) return src;
  const sf = ts.createSourceFile("codemod.ts", src, ts.ScriptTarget.Latest, true);
  const decls = matchingImports(sf, spec);
  const bound = new Set(
    decls.flatMap((d) => {
      const nb = d.importClause?.namedBindings;
      return nb && ts.isNamedImports(nb)
        ? nb.elements.filter((el) => isPlainValueSpecifier(el, false)).map((el) => el.name.text)
        : [];
    }),
  );
  const extra = wanted.filter((n) => !bound.has(n));
  if (extra.length === 0) return src;
  const target = decls[0]?.importClause?.namedBindings;
  if (target && ts.isNamedImports(target)) {
    // keep existing specifiers verbatim (`type X`, aliases) and append what is missing
    const texts = [...target.elements.map((el) => el.getText(sf)), ...extra];
    return `${src.slice(0, target.getStart(sf))}{ ${texts.join(", ")} }${src.slice(target.getEnd())}`;
  }
  const line = `import { ${extra.join(", ")} } from "${spec}";\n`;
  const shebang = /^#![^\n]*\n/.exec(src);
  return shebang ? `${shebang[0]}${line}${src.slice(shebang[0].length)}` : `${line}${src}`;
};

/** Rewrites `{ _tag: "Ok", value }` style literals to `ok(value)` etc. so carriers are built by constructors. */
export function rewriteCarrierLiterals(src: string, jsx = false): string {
  let cur = src;
  const used = new Map<string, Set<string>>();
  // each pass rewrites the outermost literals and strictly shrinks the literal count, so this terminates
  for (;;) {
    const edits = [...collectEdits(cur, jsx)].sort((a, b) => b.start - a.start);
    if (edits.length === 0) break;
    for (const e of edits) {
      cur = `${cur.slice(0, e.start)}${e.text}${cur.slice(e.end)}`;
      used.set(e.spec, (used.get(e.spec) ?? new Set()).add(e.name));
    }
  }
  return [...used].reduce((acc, [spec, names]) => addImports(acc, spec, [...names]), cur);
}
