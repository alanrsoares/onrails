/**
 * @onrails/eslint-plugin — boundary rules for `@onrails/result`.
 *
 * Rules are written against the TypeScript-ESLint AST (`TSTypeReference`,
 * `MemberExpression`, …). Consumers must use `@typescript-eslint/parser`
 * for TypeScript files; without it the rules never fire.
 */

const isIdentifierNamed = (node, name) =>
  node && node.type === "Identifier" && node.name === name;

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
      TSTypeReference(node) {
        if (!isIdentifierNamed(node.typeName, "Promise")) return;
        const args = node.typeArguments?.params;
        const inner = args?.[0];
        if (!inner || inner.type !== "TSTypeReference") return;
        if (!isIdentifierNamed(inner.typeName, "Result")) return;

        const innerArgs = inner.typeArguments?.params;
        const okT = innerArgs?.[0];
        const errT = innerArgs?.[1];
        const okText = okT ? sourceCode.getText(okT) : "T";
        const errText = errT ? sourceCode.getText(errT) : "E";

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

const noUnsafeUnwrap = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Discourage _unsafeUnwrap / _unsafeUnwrapErr outside tests.",
    },
    schema: [],
    messages: {
      unsafe: "Avoid _unsafeUnwrap* — use match(), resolve(), or yieldResult() in tryGen.",
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
