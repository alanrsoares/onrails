import { isTypeOnlyNative, isValueImport, splitImportNames, stripInlineType } from "./ast.js";
import { COMPAT_SPEC, NATIVE_SPEC } from "./constants.js";

export function toNativeImport(full: string, specifiers: string, quote: string): string {
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

export function addNativeValueImports(src: string, imports: readonly string[]): string {
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
