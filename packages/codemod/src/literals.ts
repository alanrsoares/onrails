import ts from "typescript6";
import { splitImportNames, stripInlineType, walkSource } from "./ast.js";
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

/** Names this file already binds to something other than the onrails exports. */
const foreignBindings = (sf: ts.SourceFile): ReadonlySet<string> => {
  const taken = new Set<string>();
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const spec = ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : "";
      if (spec === NATIVE_SPEC || spec === MAYBE_SPEC) continue;
      const clause = st.importClause;
      if (clause?.name) taken.add(clause.name.text);
      const nb = clause?.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) taken.add(nb.name.text);
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) taken.add(el.name.text);
    } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) {
      taken.add(st.name.text);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) taken.add(d.name.text);
      }
    }
  }
  return taken;
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
  let taken: ReadonlySet<string> = new Set();
  walkSource(
    src,
    (node, sf) => {
      if (node === sf) taken = foreignBindings(sf);
      if (!ts.isObjectLiteralExpression(node)) return false;
      const props = readProps(node);
      const tag = props && tagOf(props);
      const shape = tag ? SHAPES[tag] : undefined;
      if (!props || !shape || taken.has(shape.fn)) return false;
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

const addImports = (src: string, spec: string, names: readonly string[]): string => {
  const wanted = [...new Set(names)].sort();
  if (wanted.length === 0) return src;
  const re = new RegExp(
    String.raw`import\s+\{\s*([^}]*?)\s*\}\s+from\s+(['"])${spec.replaceAll("/", String.raw`\/`)}\2\s*;?`,
  );
  const m = re.exec(src);
  if (!m) return `import { ${wanted.join(", ")} } from "${spec}";\n${src}`;
  const merged = [
    ...new Set([...splitImportNames(m[1] ?? "").map(stripInlineType), ...wanted]),
  ].sort();
  const quote = m[2];
  return `${src.slice(0, m.index)}import { ${merged.join(", ")} } from ${quote}${spec}${quote};${src.slice(m.index + m[0].length)}`;
};

const MAX_PASSES = 8;

/** Rewrites `{ _tag: "Ok", value }` style literals to `ok(value)` etc. so carriers are built by constructors. */
export function rewriteCarrierLiterals(src: string, jsx = false): string {
  let cur = src;
  const used = new Map<string, Set<string>>();
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const edits = [...collectEdits(cur, jsx)].sort((a, b) => b.start - a.start);
    if (edits.length === 0) break;
    for (const e of edits) {
      cur = `${cur.slice(0, e.start)}${e.text}${cur.slice(e.end)}`;
      used.set(e.spec, (used.get(e.spec) ?? new Set()).add(e.name));
    }
  }
  return [...used].reduce((acc, [spec, names]) => addImports(acc, spec, [...names]), cur);
}
