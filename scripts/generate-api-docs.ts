import ts from "typescript";
import path from "node:path";
import fs from "node:fs";

interface DocSymbol {
  name: string;
  kind: "function" | "type" | "class" | "other";
  signature: string;
  description: string;
  examples: string[];
  params: { name: string; type: string; description: string }[];
  returns: string;
  category: string;
  isDeprecated: boolean;
  deprecationMessage: string;
  // Class specific fields
  constructorSig?: string;
  staticMethods?: DocSymbol[];
  instanceMethods?: DocSymbol[];
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-");
}

function resolveSymbolLink(symbolName: string, currentPackage: string): string {
  const resultSymbols = new Set([
    "Result", "Ok", "Err", "ResultAsync", "ok", "err", "map", "flatMap", "match", "bimap", "mapErr", "trySync", "tryAsync"
  ]);
  const maybeSymbols = new Set([
    "Maybe", "Some", "None", "some", "none", "isSome", "isNone", "fromNullable", "unwrapOr"
  ]);
  const patternSymbols = new Set([
    "match", "MatchBuilder", "assertNever", "matchTag", "when"
  ]);

  const slug = slugify(symbolName);
  
  if (currentPackage === "@onrails/maybe") {
    if (resultSymbols.has(symbolName)) return `./result#${slug}`;
    if (patternSymbols.has(symbolName)) return `./pattern#${slug}`;
  } else if (currentPackage === "@onrails/result") {
    if (maybeSymbols.has(symbolName)) return `./maybe#${slug}`;
    if (patternSymbols.has(symbolName)) return `./pattern#${slug}`;
  } else if (currentPackage === "@onrails/pattern") {
    if (resultSymbols.has(symbolName)) return `./result#${slug}`;
    if (maybeSymbols.has(symbolName)) return `./maybe#${slug}`;
  }
  
  return `#${slug}`;
}

function formatDescription(desc: string, currentPackage: string): string {
  return desc.replace(/\{@link\s+([^}]+)\}/g, (_, target) => {
    const cleanTarget = target.trim();
    const url = resolveSymbolLink(cleanTarget, currentPackage);
    return `[${cleanTarget}](${url})`;
  });
}

function formatExample(ex: string): string {
  const trimmed = ex.trim();
  if (trimmed.startsWith("```")) {
    return trimmed;
  }
  return `\`\`\`typescript\n${trimmed}\n\`\`\``;
}

function getBadge(kind: string): string {
  let colors = "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400";
  let label = kind;
  
  if (kind === "class") {
    colors = "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400";
  } else if (kind === "static method" || kind === "method") {
    colors = "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400";
  } else if (kind === "constructor") {
    colors = "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400";
  } else if (kind === "type") {
    colors = "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400";
  } else if (kind === "function") {
    colors = "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400";
    label = "ƒ";
  }

  const transformClass = kind === "function" ? "text-xs font-semibold px-2.5 py-0.5" : "uppercase tracking-wider px-2 py-0.5 text-[10px]";
  return `<span className="inline-flex items-center rounded-full border ${colors} ${transformClass} font-medium ml-2 align-middle">${label}</span>`;
}

function getParamTypesMap(checker: ts.TypeChecker, sigs: readonly ts.Signature[]): Map<string, string> {
  const map = new Map<string, string>();
  if (sigs.length > 0 && sigs[0]) {
    const firstSig = sigs[0];
    for (const paramSym of firstSig.getParameters()) {
      const pDecl = paramSym.valueDeclaration || paramSym.declarations?.[0];
      let pType: ts.Type;
      if (pDecl) {
        pType = checker.getTypeOfSymbolAtLocation(paramSym, pDecl);
      } else {
        pType = checker.getTypeAtLocation(paramSym.declarations?.[0] || firstSig.getDeclaration());
      }
      map.set(paramSym.getName(), checker.typeToString(pType));
    }
  }
  return map;
}

function getDefaultCategory(name: string, packageName: string, tags: readonly ts.JSDocTagInfo[]): string {
  const catTag = tags.find(t => t.name === "category");
  if (catTag) {
    return ts.displayPartsToString(catTag.text).trim();
  }

  if (packageName === "@onrails/result") {
    const isAsync = ["ResultAsync", "fromPromise", "fromSafePromise", "parallelTupleAsync", "tryAsync", "okAsync", "errAsync"].includes(name) || name.startsWith("ResultAsync.");
    if (isAsync) return "Async";
    
    if (["combine", "combineTuple"].includes(name)) {
      return "Collections";
    }
    if (["fromResult", "fromAsync", "asyncAfter"].includes(name)) {
      return "Interop";
    }
    if (["$", "tryGen", "yieldResult"].includes(name)) {
      return "Generators";
    }
    if (["Result", "Ok", "Err", "UnexpectedError", "InferOk", "InferErr"].includes(name)) {
      return "Types";
    }
    return "Core";
  }

  if (packageName === "@onrails/maybe") {
    if (["some", "none"].includes(name)) {
      return "Constructors";
    }
    if (["Maybe", "Some", "None"].includes(name)) {
      return "Types";
    }
    if (["compact", "compactMap"].includes(name)) {
      return "Collections";
    }
    if (["optional", "fromNullable"].includes(name)) {
      return "Utilities";
    }
    return "Core";
  }

  if (packageName === "@onrails/pattern") {
    if (["assertNever", "NonExhaustiveError"].includes(name)) {
      return "Diagnostics";
    }
    if (["match", "MatchBuilder", "matchTag", "when"].includes(name)) {
      return "Matching";
    }
    return "Types";
  }

  return "Core";
}

function extractDocSymbol(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  decl: ts.Declaration,
  name: string,
  packageName: string
): DocSymbol {
  const declaredType = checker.getTypeOfSymbolAtLocation(symbol, decl);
  const docComment = ts.displayPartsToString(symbol.getDocumentationComment(checker));
  const tags = symbol.getJsDocTags(checker);

  const category = getDefaultCategory(name, packageName, tags);
  const deprecationTag = tags.find(t => t.name === "deprecated");
  const isDeprecated = !!deprecationTag;
  const deprecationMessage = deprecationTag ? ts.displayPartsToString(deprecationTag.text) : "";

  let kind: "function" | "type" | "class" | "other" = "other";
  let signature = "";
  let constructorSig: string | undefined;
  let staticMethods: DocSymbol[] | undefined;
  let instanceMethods: DocSymbol[] | undefined;

  const sigs = declaredType.getCallSignatures();

  const isFunc =
    ts.isFunctionDeclaration(decl) ||
    ts.isFunctionExpression(decl) ||
    ts.isArrowFunction(decl) ||
    ts.isMethodDeclaration(decl) ||
    (ts.isVariableDeclaration(decl) && sigs.length > 0);

  if (isFunc) {
    kind = "function";
    if (sigs.length > 0) {
      signature = sigs.map(sig => `function ${name}${checker.signatureToString(sig)}`).join("\n");
    } else {
      signature = `function ${name}: ${checker.typeToString(declaredType)}`;
    }
  } else if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
    kind = "type";
    signature = decl.getText();
  } else if (ts.isClassDeclaration(decl)) {
    kind = "class";
    signature = `class ${name}`;

    const classSymbol = checker.getSymbolAtLocation(decl.name!);
    if (classSymbol) {
      const classType = checker.getDeclaredTypeOfSymbol(classSymbol);
      const staticType = checker.getTypeOfSymbolAtLocation(classSymbol, decl);

      const constructSignatures = staticType.getConstructSignatures();
      if (constructSignatures.length > 0 && constructSignatures[0]) {
        constructorSig = `constructor${checker.signatureToString(constructSignatures[0])}`;
      }

      // Static methods/properties
      const staticProps = staticType.getProperties();
      staticMethods = [];
      for (const prop of staticProps) {
        if (prop.name === "prototype" || prop.name === "name") continue;
        const propDecl = prop.valueDeclaration || prop.declarations?.[0];
        if (!propDecl) continue;

        const propFlags = ts.getCombinedModifierFlags(propDecl);
        if (propFlags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;

        const propType = checker.getTypeOfSymbolAtLocation(prop, propDecl);
        const propSigs = propType.getCallSignatures();
        const propDoc = ts.displayPartsToString(prop.getDocumentationComment(checker));
        const propTags = prop.getJsDocTags(checker);

        let propSig = "";
        if (propSigs.length > 0) {
          propSig = propSigs.map(sig => `static ${prop.name}${checker.signatureToString(sig)}`).join("\n");
        } else {
          propSig = `static ${prop.name}: ${checker.typeToString(propType)}`;
        }

        const propParamTypesMap = getParamTypesMap(checker, propSigs);
        const propDepTag = propTags.find(t => t.name === "deprecated");
        
        const propParams: { name: string; type: string; description: string }[] = [];
        if (propSigs.length > 0 && propSigs[0]) {
          const firstSig = propSigs[0];
          for (const paramSym of firstSig.getParameters()) {
            const pName = paramSym.getName();
            const pType = propParamTypesMap.get(pName) || "any";
            const paramTag = propTags.find(t => t.name === "param" && t.text && ts.displayPartsToString(t.text).startsWith(pName));
            let pDesc = "";
            if (paramTag && paramTag.text) {
              const fullText = ts.displayPartsToString(paramTag.text);
              pDesc = fullText.slice(pName.length).trim();
            }
            propParams.push({ name: pName, type: pType, description: pDesc });
          }
        }

        staticMethods.push({
          name: `${name}.${prop.name}`,
          kind: "function",
          signature: propSig,
          description: propDoc,
          examples: propTags.filter(t => t.name === "example").map(t => ts.displayPartsToString(t.text)),
          params: propParams,
          returns: ts.displayPartsToString(propTags.find(t => t.name === "returns")?.text),
          category: getDefaultCategory(`${name}.${prop.name}`, packageName, propTags),
          isDeprecated: !!propDepTag,
          deprecationMessage: propDepTag ? ts.displayPartsToString(propDepTag.text) : "",
        });
      }

      // Instance methods/properties
      const instanceProps = classType.getProperties();
      instanceMethods = [];
      for (const prop of instanceProps) {
        const propDecl = prop.valueDeclaration || prop.declarations?.[0];
        if (!propDecl) continue;

        const propFlags = ts.getCombinedModifierFlags(propDecl);
        if (propFlags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;

        const propType = checker.getTypeOfSymbolAtLocation(prop, propDecl);
        const propSigs = propType.getCallSignatures();
        const propDoc = ts.displayPartsToString(prop.getDocumentationComment(checker));
        const propTags = prop.getJsDocTags(checker);

        let propSig = "";
        if (propSigs.length > 0) {
          propSig = propSigs.map(sig => `${prop.name}${checker.signatureToString(sig)}`).join("\n");
        } else {
          propSig = `${prop.name}: ${checker.typeToString(propType)}`;
        }

        const propParamTypesMap = getParamTypesMap(checker, propSigs);
        const propDepTag = propTags.find(t => t.name === "deprecated");

        const propParams: { name: string; type: string; description: string }[] = [];
        if (propSigs.length > 0 && propSigs[0]) {
          const firstSig = propSigs[0];
          for (const paramSym of firstSig.getParameters()) {
            const pName = paramSym.getName();
            const pType = propParamTypesMap.get(pName) || "any";
            const paramTag = propTags.find(t => t.name === "param" && t.text && ts.displayPartsToString(t.text).startsWith(pName));
            let pDesc = "";
            if (paramTag && paramTag.text) {
              const fullText = ts.displayPartsToString(paramTag.text);
              pDesc = fullText.slice(pName.length).trim();
            }
            propParams.push({ name: pName, type: pType, description: pDesc });
          }
        }

        instanceMethods.push({
          name: `${name}.prototype.${prop.name}`,
          kind: "function",
          signature: propSig,
          description: propDoc,
          examples: propTags.filter(t => t.name === "example").map(t => ts.displayPartsToString(t.text)),
          params: propParams,
          returns: ts.displayPartsToString(propTags.find(t => t.name === "returns")?.text),
          category: getDefaultCategory(`${name}.prototype.${prop.name}`, packageName, propTags),
          isDeprecated: !!propDepTag,
          deprecationMessage: propDepTag ? ts.displayPartsToString(propDepTag.text) : "",
        });
      }
    }
  } else if (ts.isVariableDeclaration(decl)) {
    kind = "other";
    signature = `const ${name}: ${checker.typeToString(declaredType)}`;
  }

  const paramTypesMap = getParamTypesMap(checker, sigs);
  const params: { name: string; type: string; description: string }[] = [];

  if (sigs.length > 0 && sigs[0]) {
    const firstSig = sigs[0];
    for (const paramSym of firstSig.getParameters()) {
      const pName = paramSym.getName();
      const pType = paramTypesMap.get(pName) || "any";
      const paramTag = tags.find(t => t.name === "param" && t.text && ts.displayPartsToString(t.text).startsWith(pName));
      let pDesc = "";
      if (paramTag && paramTag.text) {
        const fullText = ts.displayPartsToString(paramTag.text);
        pDesc = fullText.slice(pName.length).trim();
      }
      params.push({ name: pName, type: pType, description: pDesc });
    }
  }

  const returnsTag = tags.find(t => t.name === "returns");
  const returns = returnsTag ? ts.displayPartsToString(returnsTag.text) : "";

  const examples = tags.filter(t => t.name === "example").map(t => ts.displayPartsToString(t.text));

  return {
    name,
    kind,
    signature,
    description: docComment,
    examples,
    params,
    returns,
    category,
    isDeprecated,
    deprecationMessage,
    constructorSig,
    staticMethods,
    instanceMethods,
  };
}

function renderSymbolMDX(sym: DocSymbol, isFirst: boolean, currentPackage: string): string {
  let mdx = "";
  if (!isFirst) {
    mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
  }

  const deprecationBadge = sym.isDeprecated
    ? ` <span className="inline-flex items-center rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-medium ml-2 align-middle uppercase tracking-wider">deprecated</span>`
    : "";

  mdx += `### ${sym.name} ${getBadge(sym.kind)}${deprecationBadge}\n\n`;

  if (sym.isDeprecated) {
    mdx += `> [!WARNING]\n> **Deprecated:** ${formatDescription(sym.deprecationMessage, currentPackage) || "This symbol is deprecated and will be removed in a future version."}\n\n`;
  }

  if (sym.description) {
    mdx += `${formatDescription(sym.description, currentPackage)}\n\n`;
  }

  if (sym.signature) {
    mdx += `\`\`\`typescript\n${sym.signature}\n\`\`\`\n\n`;
  }

  if (sym.params && sym.params.length > 0) {
    mdx += `#### Parameters\n\n| Parameter | Type | Description |\n|---|---|---|\n`;
    for (const p of sym.params) {
      const escapedType = p.type.replace(/\|/g, "\\|");
      mdx += `| \`${p.name}\` | \`${escapedType}\` | ${formatDescription(p.description, currentPackage)} |\n`;
    }
    mdx += `\n`;
  }

  if (sym.returns) {
    mdx += `#### Returns\n\n${formatDescription(sym.returns, currentPackage)}\n\n`;
  }

  if (sym.examples && sym.examples.length > 0) {
    mdx += `#### Example\n\n`;
    for (const ex of sym.examples) {
      mdx += `${formatExample(ex)}\n\n`;
    }
  }

  if (sym.kind === "class") {
    if (sym.constructorSig) {
      mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
      mdx += `### new ${sym.name} ${getBadge("constructor")}\n\n`;
      mdx += `\`\`\`typescript\n${sym.constructorSig}\n\`\`\`\n\n`;
    }

    if (sym.staticMethods && sym.staticMethods.length > 0) {
      for (const m of sym.staticMethods) {
        mdx += renderSymbolMDX(m, false, currentPackage);
      }
    }

    if (sym.instanceMethods && sym.instanceMethods.length > 0) {
      for (const m of sym.instanceMethods) {
        mdx += renderSymbolMDX(m, false, currentPackage);
      }
    }
  }

  return mdx;
}

function generateDocsForPackage(entrypoint: string, packageName: string, outputMdxPath: string) {
  const absoluteEntry = path.resolve(entrypoint);

  const program = ts.createProgram([absoluteEntry], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(absoluteEntry);

  if (!sourceFile) {
    console.error(`Could not find source file for ${entrypoint}`);
    return;
  }

  const symbols: DocSymbol[] = [];
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

  if (moduleSymbol) {
    const exports = checker.getExportsOfModule(moduleSymbol);
    for (const exp of exports) {
      const name = exp.getName();

      let sym = exp;
      if (exp.flags & ts.SymbolFlags.Alias) {
        sym = checker.getAliasedSymbol(exp);
      }

      const decl = sym.valueDeclaration || sym.declarations?.[0];
      if (!decl) continue;

      symbols.push(extractDocSymbol(checker, sym, decl, name, packageName));
    }
  }

  // Generate MDX Content grouped by category
  let mdx = `---
title: "${packageName} API"
description: "Complete API reference for ${packageName}"
---

# ${packageName} API Reference

`;

  const categoriesMap = new Map<string, DocSymbol[]>();
  for (const sym of symbols) {
    const cat = sym.category;
    if (!categoriesMap.has(cat)) {
      categoriesMap.set(cat, []);
    }
    categoriesMap.get(cat)!.push(sym);
  }

  const categoryOrder: Record<string, string[]> = {
    "@onrails/result": ["Core", "Async", "Collections", "Interop", "Generators", "Types"],
    "@onrails/maybe": ["Constructors", "Core", "Collections", "Utilities", "Types"],
    "@onrails/pattern": ["Matching", "Diagnostics", "Types"]
  };

  const preferred = categoryOrder[packageName] || [];
  const sortedCategories = Array.from(categoriesMap.keys()).sort((a, b) => {
    const idxA = preferred.indexOf(a);
    const idxB = preferred.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const cat of sortedCategories) {
    mdx += `## ${cat}\n\n`;
    const catSymbols = categoriesMap.get(cat) || [];
    // Sort symbols alphabetically inside their category
    catSymbols.sort((a, b) => a.name.localeCompare(b.name));

    let first = true;
    for (const sym of catSymbols) {
      mdx += renderSymbolMDX(sym, first, packageName);
      first = false;
    }
    mdx += "\n";
  }

  fs.mkdirSync(path.dirname(outputMdxPath), { recursive: true });
  fs.writeFileSync(outputMdxPath, mdx, "utf-8");
  console.log(`Generated docs for ${packageName} -> ${outputMdxPath}`);
}

// Generate for all three workspace packages
generateDocsForPackage(
  "packages/result/src/index.ts",
  "@onrails/result",
  "apps/docs/content/docs/api/result.mdx"
);

generateDocsForPackage(
  "packages/maybe/src/index.ts",
  "@onrails/maybe",
  "apps/docs/content/docs/api/maybe.mdx"
);

generateDocsForPackage(
  "packages/pattern/src/index.ts",
  "@onrails/pattern",
  "apps/docs/content/docs/api/pattern.mdx"
);
