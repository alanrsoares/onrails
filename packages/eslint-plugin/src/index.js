/**
 * @onrails/eslint-plugin — boundary rules for `@onrails/result`.
 *
 * Rules are written against the TypeScript-ESLint AST (`TSTypeReference`,
 * `MemberExpression`, …). Consumers must use `@typescript-eslint/parser`
 * for TypeScript files; without it the rules never fire.
 */

/**
 * Loose AST-node shape — typescript-eslint nodes (TSTypeReference, …) are not
 * part of ESLint's bundled estree types, so rules narrow on `type` manually.
 *
 * @param {{ type: string; name?: string } | null | undefined} node
 * @param {string} name
 * @returns {boolean}
 */
const isIdentifierNamed = (node, name) =>
  Boolean(node && node.type === "Identifier" && node.name === name);

/**
 * Minimal structural view of `@typescript-eslint/parser`'s TSTypeReference —
 * only the fields these rules read. ESLint's bundled types know estree alone,
 * so TS-AST visitors type their own slice and bridge at report boundaries.
 *
 * @typedef {object} TsTypeReference
 * @property {string} type
 * @property {{ type: string; name?: string }} typeName
 * @property {{ params: TsTypeReference[] } | undefined} [typeArguments]
 */

/**
 * Safe: TS-AST nodes carry the same range/loc contract ESLint needs; the
 * bundled estree types just cannot name them.
 *
 * @param {TsTypeReference} node
 * @returns {import('eslint').Rule.Node}
 */
const asReportable = (node) =>
  /** @type {import('eslint').Rule.Node} */ (/** @type {unknown} */ (node));

/**
 * Safe: the `TSTypeReference` visitor key guarantees the parser produced a
 * typescript-eslint TSTypeReference node.
 *
 * @param {import('eslint').Rule.Node} node
 * @returns {TsTypeReference}
 */
const asTsTypeReference = (node) => /** @type {TsTypeReference} */ (/** @type {unknown} */ (node));

/** @type {import('eslint').Rule.RuleModule} */
const noPromiseResult = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Disallow Promise<Result<…>> in public signatures — return ResultAsync<T, E> instead.",
    },
    schema: [],
    messages: {
      use: "Promise<Result<{{ok}}, {{err}}>> in public API — return ResultAsync<{{ok}}, {{err}}> and use fromAsync()/tryAsync() at the boundary.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      TSTypeReference(/** @type {import('eslint').Rule.Node} */ node) {
        const typeRef = asTsTypeReference(node);
        if (!isIdentifierNamed(typeRef.typeName, "Promise")) return;
        const args = typeRef.typeArguments?.params;
        const inner = args?.[0];
        if (inner?.type !== "TSTypeReference") return;
        if (!isIdentifierNamed(inner.typeName, "Result")) return;

        const innerArgs = inner.typeArguments?.params;
        const okT = innerArgs?.[0];
        const errT = innerArgs?.[1];
        const okText = okT ? sourceCode.getText(asReportable(okT)) : "T";
        const errText = errT ? sourceCode.getText(asReportable(errT)) : "E";

        context.report({
          node,
          messageId: "use",
          data: { ok: okText, err: errText },
          fix: (fixer) => fixer.replaceText(node, `ResultAsync<${okText}, ${errText}>`),
        });
      },
    };
  },
};

/** @type {import('eslint').Rule.RuleModule} */
const noUnsafeUnwrap = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Discourage _unsafeUnwrap / _unsafeUnwrapErr and unwrapOk / unwrapErr / unwrap outside tests. Matching is name-based; same-named functions from other libraries are flagged too.",
    },
    schema: [],
    messages: {
      unsafe:
        "Avoid _unsafeUnwrap* and unwrap* outside tests — use match(), resolve(), or yieldResult() in tryGen.",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    if (filename.includes(".spec.") || filename.includes(".test.")) {
      return {};
    }
    return {
      MemberExpression(node) {
        if (
          node.property.type === "Identifier" &&
          (node.property.name === "_unsafeUnwrap" || node.property.name === "_unsafeUnwrapErr")
        ) {
          context.report({ node, messageId: "unsafe" });
        }
      },
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          (node.callee.name === "unwrapOk" ||
            node.callee.name === "unwrapErr" ||
            node.callee.name === "unwrap")
        ) {
          context.report({ node, messageId: "unsafe" });
        }
      },
    };
  },
};

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: "@onrails/eslint-plugin",
    version: "0.0.0",
  },
  rules: {
    "no-promise-result": noPromiseResult,
    "no-unsafe-unwrap": noUnsafeUnwrap,
  },
};

export default plugin;

export const configs = {
  recommended: {
    plugins: {
      "@onrails/result": plugin,
    },
    rules: {
      "@onrails/result/no-promise-result": "warn",
      "@onrails/result/no-unsafe-unwrap": "warn",
    },
  },
};
