import { match } from "@onrails/pattern";
import type { ApiDocsOptions, DocSymbol, ExportsByPackage } from "./types.js";

type LinkResolver = (symbol: string) => string;

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-");

const shortName = (packageName: string): string => packageName.split("/").pop() ?? packageName;

/**
 * Default `{@link}` resolver: local anchor when the current package exports the
 * symbol, else a sibling-package link (`./<name>#slug`), else a local anchor.
 */
export const defaultResolveLink = (
  symbol: string,
  currentPackage: string,
  exports: ExportsByPackage,
): string => {
  const slug = slugify(symbol);
  if (exports.get(currentPackage)?.has(symbol)) return `#${slug}`;
  for (const [pkg, syms] of exports) {
    if (pkg !== currentPackage && syms.has(symbol)) return `./${shortName(pkg)}#${slug}`;
  }
  return `#${slug}`;
};

const formatDescription = (desc: string, link: LinkResolver): string =>
  desc.replace(/\{@link\s+([^}]+)\}/g, (_, target) => {
    const clean = String(target).trim();
    return `[${clean}](${link(clean)})`;
  });

const formatExample = (ex: string): string => {
  const trimmed = ex.trim();
  return trimmed.startsWith("```") ? trimmed : `\`\`\`typescript\n${trimmed}\n\`\`\``;
};

const NEUTRAL =
  "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400";

const getBadge = (kind: string): string => {
  const { colors, label } = match(kind)
    .returnType<{ colors: string; label: string }>()
    .with("class", () => ({
      colors:
        "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
      label: kind,
    }))
    .withEither("static method", "method", () => ({
      colors:
        "border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400",
      label: kind,
    }))
    .with("constructor", () => ({
      colors:
        "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400",
      label: kind,
    }))
    .with("type", () => ({
      colors:
        "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400",
      label: kind,
    }))
    .with("function", () => ({
      colors:
        "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
      label: "ƒ",
    }))
    .otherwise(() => ({ colors: NEUTRAL, label: kind }));

  const transformClass =
    kind === "function"
      ? "text-xs font-semibold px-2.5 py-0.5"
      : "uppercase tracking-wider px-2 py-0.5 text-[10px]";
  return `<span className="inline-flex items-center rounded-full border ${colors} ${transformClass} font-medium ml-2 align-middle">${label}</span>`;
};

const renderSymbolMDX = (sym: DocSymbol, isFirst: boolean, link: LinkResolver): string => {
  let mdx = "";
  if (!isFirst) {
    mdx += `<hr className="my-8 border-neutral-200 dark:border-neutral-800" />\n\n`;
  }

  const deprecationBadge = sym.isDeprecated
    ? ` <span className="inline-flex items-center rounded-full border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-medium ml-2 align-middle uppercase tracking-wider">deprecated</span>`
    : "";

  mdx += `### ${sym.name} ${getBadge(sym.kind)}${deprecationBadge}\n\n`;

  if (sym.isDeprecated) {
    mdx += `> [!WARNING]\n> **Deprecated:** ${formatDescription(sym.deprecationMessage, link) || "This symbol is deprecated and will be removed in a future version."}\n\n`;
  }

  if (sym.description) {
    mdx += `${formatDescription(sym.description, link)}\n\n`;
  }

  if (sym.signature) {
    mdx += `\`\`\`typescript\n${sym.signature}\n\`\`\`\n\n`;
  }

  if (sym.params.length > 0) {
    mdx += `#### Parameters\n\n| Parameter | Type | Description |\n|---|---|---|\n`;
    for (const p of sym.params) {
      const escapedType = p.type.replace(/\|/g, "\\|");
      mdx += `| \`${p.name}\` | \`${escapedType}\` | ${formatDescription(p.description, link)} |\n`;
    }
    mdx += `\n`;
  }

  if (sym.returns) {
    mdx += `#### Returns\n\n${formatDescription(sym.returns, link)}\n\n`;
  }

  if (sym.examples.length > 0) {
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
    for (const m of sym.staticMethods ?? []) mdx += renderSymbolMDX(m, false, link);
    for (const m of sym.instanceMethods ?? []) mdx += renderSymbolMDX(m, false, link);
  }

  return mdx;
};

const sortCategories = (categories: string[], preferred: readonly string[]): string[] =>
  [...categories].sort((a, b) => {
    const idxA = preferred.indexOf(a);
    const idxB = preferred.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

/** Render a package's DocSymbols to an MDX document. */
export const renderPackageMdx = (
  packageName: string,
  symbols: readonly DocSymbol[],
  exports: ExportsByPackage,
  opts: ApiDocsOptions = {},
): string => {
  const resolve = opts.resolveLink ?? defaultResolveLink;
  const link: LinkResolver = (symbol) => resolve(symbol, packageName, exports);

  let mdx = `---
title: "${packageName} API"
description: "Complete API reference for ${packageName}"
---

# ${packageName} API Reference

`;

  const byCategory = new Map<string, DocSymbol[]>();
  for (const sym of symbols) {
    const list = byCategory.get(sym.category) ?? [];
    list.push(sym);
    byCategory.set(sym.category, list);
  }

  const preferred = opts.categoryOrder?.[packageName] ?? [];
  for (const cat of sortCategories([...byCategory.keys()], preferred)) {
    mdx += `## ${cat}\n\n`;
    const catSymbols = (byCategory.get(cat) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    let first = true;
    for (const sym of catSymbols) {
      mdx += renderSymbolMDX(sym, first, link);
      first = false;
    }
    mdx += "\n";
  }

  return mdx;
};
