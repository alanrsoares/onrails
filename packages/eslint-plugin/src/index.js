/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: "@onrails/eslint-plugin",
    version: "0.0.0",
  },
  rules: {
    "no-promise-result": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow Promise<Result<…>> in public signatures — use ResultAsync (Alanstack boundary rule)",
        },
        schema: [],
        messages: {
          noPromiseResult:
            "Avoid Promise<Result<{{types}}>> in exported APIs. Return ResultAsync<T, E> and use fromAsync() inside handlers.",
        },
      },
      create(context) {
        const source = context.sourceCode.getText();

        return {
          Program() {
            const pattern = /Promise\s*<\s*Result\s*</g;
            let match = pattern.exec(source);
            while (match !== null) {
              const start = match.index;
              const line = source.slice(0, start).split("\n").length;
              const lineStart = source.lastIndexOf("\n", start) + 1;
              const lineText = source.slice(lineStart, source.indexOf("\n", start));
              if (lineText.trimStart().startsWith("//")) {
                match = pattern.exec(source);
                continue;
              }
              context.report({
                loc: { line, column: match.index - lineStart },
                messageId: "noPromiseResult",
                data: { types: "…" },
              });
              match = pattern.exec(source);
            }
          },
        };
      },
    },
    "no-unsafe-unwrap": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Discourage _unsafeUnwrap / _unsafeUnwrapErr outside tests",
        },
        schema: [],
        messages: {
          unsafe:
            "Avoid _unsafeUnwrap* — use match(), resolve(), or yieldResult() in tryGen.",
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
              (node.property.name === "_unsafeUnwrap" ||
                node.property.name === "_unsafeUnwrapErr")
            ) {
              context.report({ node, messageId: "unsafe" });
            }
          },
        };
      },
    },
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
