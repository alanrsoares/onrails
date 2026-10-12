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

const importedLocals = (sf: ts.SourceFile): readonly string[] =>
  sf.statements.flatMap((st) => {
    if (!ts.isImportDeclaration(st)) return [];
    const spec = ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : "";
    if (spec === NATIVE_SPEC || spec === MAYBE_SPEC) return [];
    const clause = st.importClause;
    const nb = clause?.namedBindings;
    return [
      ...(clause?.name ? [clause.name.text] : []),
      ...(nb && ts.isNamespaceImport(nb) ? [nb.name.text] : []),
      ...(nb && ts.isNamedImports(nb) ? nb.elements.map((el) => el.name.text) : []),
    ];
  });

/** Names a single scope-creating node binds for the code inside it. */
const boundBy = (node: ts.Node): readonly string[] => {
  if (ts.isSourceFile(node)) return [...importedLocals(node), ...declaredIn(node.statements)];
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
    return [...own, ...node.parameters.flatMap((p) => bindingNames(p.name))];
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

const importName = (el: ts.ImportSpecifier): string => (el.propertyName ?? el.name).text;

/** Merges `names` into the value import of `spec` (found through the parser), or inserts one after any shebang. */
const addImports = (src: string, spec: string, names: readonly string[]): string => {
  const wanted = [...new Set(names)].sort();
  if (wanted.length === 0) return src;
  const sf = ts.createSourceFile("codemod.ts", src, ts.ScriptTarget.Latest, true);
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    if (st.moduleSpecifier.text !== spec || st.importClause?.isTypeOnly) continue;
    const nb = st.importClause?.namedBindings;
    if (!nb || !ts.isNamedImports(nb)) continue;
    // keep existing specifiers verbatim (`type X`, aliases) and only add what is missing
    const have = new Set(nb.elements.filter((el) => !el.isTypeOnly).map(importName));
    const extra = wanted.filter((n) => !have.has(n));
    if (extra.length === 0) return src;
    const texts = [...nb.elements.map((el) => el.getText(sf)), ...extra];
    return `${src.slice(0, nb.getStart(sf))}{ ${texts.join(", ")} }${src.slice(nb.getEnd())}`;
  }
  const line = `import { ${wanted.join(", ")} } from "${spec}";\n`;
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
