import ts from "typescript";
import path from "node:path";
import fs from "node:fs";

interface DocSymbol {
  name: string;
  kind: "function" | "type" | "class" | "other";
  signature: string;
  description: string;
  examples: string[];
  params: { name: string; description: string }[];
  returns: string;
  // Class specific fields
  constructorSig?: string;
  staticMethods?: DocSymbol[];
  instanceMethods?: DocSymbol[];
}

function formatExample(ex: string): string {
  const trimmed = ex.trim();
  if (trimmed.startsWith("```")) {
    return trimmed;
  }
  return `\`\`\`typescript\n${trimmed}\n\`\`\``;
}

function formatDescription(desc: string): string {
  return desc.replace(/\{@link\s+([^}]+)\}/g, "`$1`");
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

function extractDocSymbol(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  decl: ts.Declaration,
  name: string
): DocSymbol {
  const declaredType = checker.getTypeOfSymbolAtLocation(symbol, decl);
  const docComment = ts.displayPartsToString(symbol.getDocumentationComment(checker));
  const tags = symbol.getJsDocTags(checker);

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

        staticMethods.push({
          name: `${name}.${prop.name}`,
          kind: "function",
          signature: propSig,
          description: propDoc,
          examples: propTags.filter(t => t.name === "example").map(t => ts.displayPartsToString(t.text)),
          params: propTags.filter(t => t.name === "param" && t.text).map(t => {
            const parts = ts.displayPartsToString(t.text).split(/\s+/);
            return { name: parts[0] || "", description: parts.slice(1).join(" ") };
          }),
          returns: ts.displayPartsToString(propTags.find(t => t.name === "returns")?.text),
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

        instanceMethods.push({
          name: `${name}.prototype.${prop.name}`,
          kind: "function",
          signature: propSig,
          description: propDoc,
          examples: propTags.filter(t => t.name === "example").map(t => ts.displayPartsToString(t.text)),
          params: propTags.filter(t => t.name === "param" && t.text).map(t => {
            const parts = ts.displayPartsToString(t.text).split(/\s+/);
            return { name: parts[0] || "", description: parts.slice(1).join(" ") };
          }),
          returns: ts.displayPartsToString(propTags.find(t => t.name === "returns")?.text),
        });
      }
    }
  } else if (ts.isVariableDeclaration(decl)) {
    kind = "other";
    signature = `const ${name}: ${checker.typeToString(declaredType)}`;
  }

  const params: { name: string; description: string }[] = [];
  let returns = "";
  const examples: string[] = [];

  for (const tag of tags) {
    if (tag.name === "param" && tag.text) {
      const parts = ts.displayPartsToString(tag.text).split(/\s+/);
      const pName = parts[0] || "";
      const pDesc = parts.slice(1).join(" ");
      params.push({ name: pName, description: pDesc });
    } else if (tag.name === "returns" && tag.text) {
      returns = ts.displayPartsToString(tag.text);
    } else if (tag.name === "example" && tag.text) {
      examples.push(ts.displayPartsToString(tag.text));
    }
  }

  return {
    name,
    kind,
    signature,
    description: docComment,
    examples,
    params,
    returns,
    constructorSig,
    staticMethods,
    instanceMethods,
  };
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

      symbols.push(extractDocSymbol(checker, sym, decl, name));
    }
  }

  // Generate MDX Content
  let mdx = `---
title: "${packageName} API"
description: "Complete API reference for ${packageName}"
---

# ${packageName} API Reference

`;

  const classes = symbols.filter(s => s.kind === "class");
  const functions = symbols.filter(s => s.kind === "function");
  const types = symbols.filter(s => s.kind === "type");
  const others = symbols.filter(s => s.kind === "other");

  if (classes.length > 0) {
    mdx += `## Classes\n\n`;
    for (const c of classes) {
      mdx += `### ${c.name} ${getBadge("class")}\n\n`;
      if (c.description) {
        mdx += `${formatDescription(c.description)}\n\n`;
      }

      if (c.constructorSig) {
        mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
        mdx += `### new ${c.name} ${getBadge("constructor")}\n\n`;
        mdx += `\`\`\`typescript\n${c.constructorSig}\n\`\`\`\n\n`;
      }

      if (c.staticMethods && c.staticMethods.length > 0) {
        for (const m of c.staticMethods) {
          mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
          mdx += `### ${m.name} ${getBadge("static method")}\n\n`;
          if (m.description) {
            mdx += `${formatDescription(m.description)}\n\n`;
          }
          mdx += `\`\`\`typescript\n${m.signature}\n\`\`\`\n\n`;

          if (m.params.length > 0) {
            mdx += `| Parameter | Description |\n|---|---|\n`;
            for (const p of m.params) {
              mdx += `| \`${p.name}\` | ${formatDescription(p.description)} |\n`;
            }
            mdx += `\n`;
          }

          if (m.returns) {
            mdx += `**Returns:** ${formatDescription(m.returns)}\n\n`;
          }

          if (m.examples.length > 0) {
            mdx += `**Example:**\n\n`;
            for (const ex of m.examples) {
              mdx += `${formatExample(ex)}\n\n`;
            }
          }
        }
      }

      if (c.instanceMethods && c.instanceMethods.length > 0) {
        for (const m of c.instanceMethods) {
          mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
          mdx += `### ${m.name} ${getBadge("method")}\n\n`;
          if (m.description) {
            mdx += `${formatDescription(m.description)}\n\n`;
          }
          mdx += `\`\`\`typescript\n${m.signature}\n\`\`\`\n\n`;

          if (m.params.length > 0) {
            mdx += `| Parameter | Description |\n|---|---|\n`;
            for (const p of m.params) {
              mdx += `| \`${p.name}\` | ${formatDescription(p.description)} |\n`;
            }
            mdx += `\n`;
          }

          if (m.returns) {
            mdx += `**Returns:** ${formatDescription(m.returns)}\n\n`;
          }

          if (m.examples.length > 0) {
            mdx += `**Example:**\n\n`;
            for (const ex of m.examples) {
              mdx += `${formatExample(ex)}\n\n`;
            }
          }
        }
      }
    }
  }

  if (functions.length > 0) {
    mdx += `## Functions\n\n`;
    let first = true;
    for (const f of functions) {
      if (!first) {
        mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
      }
      first = false;

      mdx += `### ${f.name} ${getBadge("function")}\n\n`;
      if (f.description) {
        mdx += `${formatDescription(f.description)}\n\n`;
      }
      mdx += `\`\`\`typescript\n${f.signature}\n\`\`\`\n\n`;

      if (f.params.length > 0) {
        mdx += `#### Parameters\n\n| Parameter | Description |\n|---|---|\n`;
        for (const p of f.params) {
          mdx += `| \`${p.name}\` | ${formatDescription(p.description)} |\n`;
        }
        mdx += `\n`;
      }

      if (f.returns) {
        mdx += `#### Returns\n\n${formatDescription(f.returns)}\n\n`;
      }

      if (f.examples.length > 0) {
        mdx += `#### Example\n\n`;
        for (const ex of f.examples) {
          mdx += `${formatExample(ex)}\n\n`;
        }
      }
    }
  }

  if (types.length > 0) {
    mdx += `## Types\n\n`;
    let first = true;
    for (const t of types) {
      if (!first) {
        mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
      }
      first = false;

      mdx += `### ${t.name} ${getBadge("type")}\n\n`;
      if (t.description) {
        mdx += `${formatDescription(t.description)}\n\n`;
      }
      mdx += `\`\`\`typescript\n${t.signature}\n\`\`\`\n\n`;
    }
  }

  if (others.length > 0) {
    mdx += `## Constants / Variables\n\n`;
    let first = true;
    for (const o of others) {
      if (!first) {
        mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
      }
      first = false;

      mdx += `### ${o.name} ${getBadge("variable")}\n\n`;
      if (o.description) {
        mdx += `${formatDescription(o.description)}\n\n`;
      }
      mdx += `\`\`\`typescript\n${o.signature}\n\`\`\`\n\n`;
    }
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
