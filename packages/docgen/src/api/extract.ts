import { resolve } from "node:path";
import { err, flatMap, ok, type Result, trySync } from "@onrails/result";
import ts from "typescript";
import { defaultCompilerHost } from "./host.js";
import { toError } from "./to-error.js";
import type { ApiCompilerHost, DocParam, DocSymbol } from "./types.js";

/** Resolves a symbol's category from JSDoc tags + package context. */
export type Categorize = (
  name: string,
  packageName: string,
  tags: readonly ts.JSDocTagInfo[],
) => string;

/** Default: honor an explicit `@category` tag, else `"Core"`. */
export const defaultCategorize: Categorize = (_name, _packageName, tags) => {
  const catTag = tags.find((t) => t.name === "category");
  return catTag ? ts.displayPartsToString(catTag.text).trim() : "Core";
};

const getParamTypesMap = (
  checker: ts.TypeChecker,
  sigs: readonly ts.Signature[],
): Map<string, string> => {
  const map = new Map<string, string>();
  const firstSig = sigs[0];
  if (!firstSig) return map;
  for (const paramSym of firstSig.getParameters()) {
    const pDecl = paramSym.valueDeclaration ?? paramSym.declarations?.[0];
    const pType = pDecl
      ? checker.getTypeOfSymbolAtLocation(paramSym, pDecl)
      : checker.getTypeAtLocation(paramSym.declarations?.[0] ?? firstSig.getDeclaration());
    map.set(paramSym.getName(), checker.typeToString(pType));
  }
  return map;
};

const paramDescription = (tags: readonly ts.JSDocTagInfo[], pName: string): string => {
  const paramTag = tags.find(
    (t) => t.name === "param" && t.text && ts.displayPartsToString(t.text).startsWith(pName),
  );
  if (!paramTag?.text) return "";
  return ts.displayPartsToString(paramTag.text).slice(pName.length).trim();
};

const collectParams = (
  sigs: readonly ts.Signature[],
  typesMap: Map<string, string>,
  tags: readonly ts.JSDocTagInfo[],
): DocParam[] => {
  const firstSig = sigs[0];
  if (!firstSig) return [];
  return firstSig.getParameters().map((paramSym) => {
    const name = paramSym.getName();
    return { name, type: typesMap.get(name) ?? "any", description: paramDescription(tags, name) };
  });
};

const examplesOf = (tags: readonly ts.JSDocTagInfo[]): string[] =>
  tags.filter((t) => t.name === "example").map((t) => ts.displayPartsToString(t.text));

const returnsOf = (tags: readonly ts.JSDocTagInfo[]): string => {
  const tag = tags.find((t) => t.name === "returns");
  return tag ? ts.displayPartsToString(tag.text) : "";
};

const isVisible = (decl: ts.Declaration): boolean => {
  const flags = ts.getCombinedModifierFlags(decl);
  return !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected));
};

const memberSymbol = (
  checker: ts.TypeChecker,
  prop: ts.Symbol,
  propDecl: ts.Declaration,
  qualifiedName: string,
  packageName: string,
  categorize: Categorize,
  isStatic: boolean,
): DocSymbol => {
  const propType = checker.getTypeOfSymbolAtLocation(prop, propDecl);
  const propSigs = propType.getCallSignatures();
  const tags = prop.getJsDocTags(checker);
  const prefix = isStatic ? "static " : "";
  const signature =
    propSigs.length > 0
      ? propSigs.map((sig) => `${prefix}${prop.name}${checker.signatureToString(sig)}`).join("\n")
      : `${prefix}${prop.name}: ${checker.typeToString(propType)}`;
  const depTag = tags.find((t) => t.name === "deprecated");
  return {
    name: qualifiedName,
    kind: "function",
    signature,
    description: ts.displayPartsToString(prop.getDocumentationComment(checker)),
    examples: examplesOf(tags),
    params: collectParams(propSigs, getParamTypesMap(checker, propSigs), tags),
    returns: returnsOf(tags),
    category: categorize(qualifiedName, packageName, tags),
    isDeprecated: !!depTag,
    deprecationMessage: depTag ? ts.displayPartsToString(depTag.text) : "",
  };
};

const classMembers = (
  checker: ts.TypeChecker,
  decl: ts.ClassDeclaration,
  name: string,
  packageName: string,
  categorize: Categorize,
): Pick<DocSymbol, "constructorSig" | "staticMethods" | "instanceMethods"> => {
  if (!decl.name) return {};
  const classSymbol = checker.getSymbolAtLocation(decl.name);
  if (!classSymbol) return {};

  const classType = checker.getDeclaredTypeOfSymbol(classSymbol);
  const staticType = checker.getTypeOfSymbolAtLocation(classSymbol, decl);

  const constructSig = staticType.getConstructSignatures()[0];
  const constructorSig = constructSig
    ? `constructor${checker.signatureToString(constructSig)}`
    : undefined;

  const collectMembers = (props: ts.Symbol[], isStatic: boolean): DocSymbol[] => {
    const out: DocSymbol[] = [];
    for (const prop of props) {
      if (isStatic && (prop.name === "prototype" || prop.name === "name")) continue;
      const propDecl = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!propDecl || !isVisible(propDecl)) continue;
      const qualified = isStatic ? `${name}.${prop.name}` : `${name}.prototype.${prop.name}`;
      out.push(memberSymbol(checker, prop, propDecl, qualified, packageName, categorize, isStatic));
    }
    return out;
  };

  return {
    ...(constructorSig !== undefined ? { constructorSig } : {}),
    staticMethods: collectMembers(staticType.getProperties(), true),
    instanceMethods: collectMembers(classType.getProperties(), false),
  };
};

const isFunctionLike = (decl: ts.Declaration, sigs: readonly ts.Signature[]): boolean =>
  ts.isFunctionDeclaration(decl) ||
  ts.isFunctionExpression(decl) ||
  ts.isArrowFunction(decl) ||
  ts.isMethodDeclaration(decl) ||
  (ts.isVariableDeclaration(decl) && sigs.length > 0);

const extractDocSymbol = (
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  decl: ts.Declaration,
  name: string,
  packageName: string,
  categorize: Categorize,
): DocSymbol => {
  const declaredType = checker.getTypeOfSymbolAtLocation(symbol, decl);
  const tags = symbol.getJsDocTags(checker);
  const sigs = declaredType.getCallSignatures();
  const depTag = tags.find((t) => t.name === "deprecated");

  let kind: DocSymbol["kind"] = "other";
  let signature = "";
  let classFields: Pick<DocSymbol, "constructorSig" | "staticMethods" | "instanceMethods"> = {};

  if (isFunctionLike(decl, sigs)) {
    kind = "function";
    signature =
      sigs.length > 0
        ? sigs.map((sig) => `function ${name}${checker.signatureToString(sig)}`).join("\n")
        : `function ${name}: ${checker.typeToString(declaredType)}`;
  } else if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
    kind = "type";
    signature = decl.getText();
  } else if (ts.isClassDeclaration(decl)) {
    kind = "class";
    signature = `class ${name}`;
    classFields = classMembers(checker, decl, name, packageName, categorize);
  } else if (ts.isVariableDeclaration(decl)) {
    signature = `const ${name}: ${checker.typeToString(declaredType)}`;
  }

  return {
    name,
    kind,
    signature,
    description: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
    examples: examplesOf(tags),
    params: collectParams(sigs, getParamTypesMap(checker, sigs), tags),
    returns: returnsOf(tags),
    category: categorize(name, packageName, tags),
    isDeprecated: !!depTag,
    deprecationMessage: depTag ? ts.displayPartsToString(depTag.text) : "",
    ...classFields,
  };
};

/** Parse a package entrypoint and return its exported symbols as DocSymbols. */
const moduleSymbols = (
  checker: ts.TypeChecker,
  moduleSymbol: ts.Symbol,
  packageName: string,
  categorize: Categorize,
): DocSymbol[] => {
  const symbols: DocSymbol[] = [];
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const decl = sym.valueDeclaration ?? sym.declarations?.[0];
    if (!decl) continue;
    symbols.push(extractDocSymbol(checker, sym, decl, exp.getName(), packageName, categorize));
  }
  return symbols;
};

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
};

// The TS compiler is a third-party boundary — both program creation and the
// symbol walk can throw (e.g. synthesized signatures whose getDeclaration() is
// typed non-null but is undefined at runtime). Wrap both as Result.
const walkExports = trySync(
  (checker: ts.TypeChecker, moduleSymbol: ts.Symbol, packageName: string, categorize: Categorize) =>
    moduleSymbols(checker, moduleSymbol, packageName, categorize),
  toError,
);

export const extractExports = (
  entry: string,
  packageName: string,
  categorize: Categorize,
  host: ApiCompilerHost = defaultCompilerHost,
): Result<DocSymbol[], Error> => {
  const absoluteEntry = resolve(entry);
  const createProgram = trySync(
    () => host.createProgram([absoluteEntry], COMPILER_OPTIONS),
    toError,
  );
  return flatMap(createProgram(), (prog) => {
    const checker = prog.getTypeChecker();
    const sourceFile = prog.getSourceFile(absoluteEntry);
    if (!sourceFile) return err(new Error(`Could not find source file for ${entry}`));
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    return moduleSymbol ? walkExports(checker, moduleSymbol, packageName, categorize) : ok([]);
  });
};
