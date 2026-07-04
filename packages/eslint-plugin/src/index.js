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

/**
 * Deprecated synonym → canonical rename tables. Hand-copied from
 * `@onrails/codemod` `src/boundary-spec.ts` (cross-package imports are
 * forbidden); `packages/codemod/test/boundary-conformance.spec.ts` keeps the
 * copies in sync with the spec and the Biome `no-deprecated-synonyms.grit`.
 */

/** Flagged as `x.name(…)`. `isOk` / `isErr` map to the same-named free-function guards. */
const DEPRECATED_METHOD_RENAMES = new Map([
  ["chain", "flatMap"],
  ["isOk", "isOk"],
  ["isErr", "isErr"],
]);

/** Flagged as `name(…)`. */
const DEPRECATED_CALL_RENAMES = new Map([
  ["fold", "match"],
  ["matchResult", "match"],
  ["matchMaybe", "match"],
  ["getOrElse", "unwrapOr"],
  ["sequenceTupleAsync", "ResultAsync.combineTuple"],
  ["collect", "combine"],
  ["of", "ok"],
]);

/** @type {import('eslint').Rule.RuleModule} */
const noDeprecatedSynonyms = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag deprecated railway/maybe synonyms (chain, fold, getOrElse, of, …) and suggest the canonical onrails names. Matching is name-based; same-named functions from other libraries are flagged too.",
    },
    schema: [],
    messages: {
      rename: "{{name}}() is a deprecated onrails synonym — use {{canonical}}() instead.",
      narrowGuard:
        "Deprecated .{{name}}() method — await the ResultAsync and narrow with the {{name}}() free function instead.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === "Identifier") {
          const canonical = DEPRECATED_CALL_RENAMES.get(callee.name);
          if (canonical) {
            context.report({
              node,
              messageId: "rename",
              data: { name: callee.name, canonical },
            });
          }
          return;
        }
        if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return;
        const name = callee.property.name;
        const canonical = DEPRECATED_METHOD_RENAMES.get(name);
        if (!canonical) return;
        context.report(
          canonical === name
            ? { node, messageId: "narrowGuard", data: { name } }
            : { node, messageId: "rename", data: { name, canonical } },
        );
      },
    };
  },
};

/**
 * Fluent wrapper types and serialize-sink names. Hand-copied from
 * `@onrails/codemod` `src/boundary-spec.ts` (cross-package imports are
 * forbidden); `packages/codemod/test/boundary-conformance.spec.ts` keeps the
 * copies in sync.
 */
const FLUENT_WRAPPER_TYPES = new Set(["FluentResult", "FluentMaybe"]);
const FLUENT_ESCAPE_SINKS = new Set(["postMessage", "structuredClone", "JSON.stringify"]);
/** Fluent methods that exit the wrapper — a chain ending here is already plain data. */
const FLUENT_TERMINAL_METHODS = new Set(["toResult", "toMaybe", "toString", "match", "unwrapOr"]);

/**
 * Loose parent-chain node shape for structural classification — mirrors
 * {@link TsTypeReference} for nodes outside estree's bundled types
 * (`TSTypeAnnotation`, `PropertyDefinition`, `VariableDeclarator`, …).
 *
 * @typedef {object} LooseNode
 * @property {string} type
 * @property {string} [name]
 * @property {LooseNode} [parent]
 * @property {LooseNode} [returnType]
 * @property {LooseNode} [object]
 * @property {LooseNode} [property]
 * @property {LooseNode} [callee]
 */

/**
 * @param {unknown} node
 * @returns {LooseNode}
 */
const asLoose = (node) => /** @type {LooseNode} */ (node);

/**
 * @param {LooseNode} node
 * @returns {string}
 */
const calleeName = (node) => {
  if (node.type === "Identifier") return node.name ?? "";
  if (
    node.type === "MemberExpression" &&
    node.object?.type === "Identifier" &&
    node.property?.type === "Identifier"
  )
    return `${node.object.name}.${node.property.name}`;
  return "";
};

/**
 * True when `node` still holds a fluent wrapper — a call chain rooted at
 * `fluent(...)` that hasn't reached a terminal (`toResult`, `match`, …) yet.
 * `fluent(r).toResult()` is plain data by the time it reaches a sink;
 * `fluent(r)` and `fluent(r).map(f)` are not. Purely syntactic: a
 * `fluent(...)` result stashed in a variable first is out of reach without
 * type information.
 *
 * @param {unknown} node
 * @returns {boolean}
 */
const isFluentChain = (node) => {
  if (!node) return false;
  const loose = asLoose(node);
  if (loose.type !== "CallExpression" || !loose.callee) return false;
  if (loose.callee.type === "Identifier") return loose.callee.name === "fluent";
  if (loose.callee.type === "MemberExpression") {
    const method = loose.callee.property?.name;
    if (method && FLUENT_TERMINAL_METHODS.has(method)) return false;
    return isFluentChain(loose.callee.object);
  }
  return false;
};

/** @type {import('eslint').Rule.RuleModule} */
const fluentStaysLocal = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow FluentResult/FluentMaybe escaping its function — as a return type, an exported binding, a stored field, or an argument to a serialize/postMessage/cache call.",
    },
    schema: [],
    messages: {
      returnType:
        "{{name}} as a function return type lets the fluent wrapper escape — call toResult()/toMaybe()/toString() and return plain data instead.",
      exported:
        "{{name}} on an exported binding lets the fluent wrapper escape its module — call toResult()/toMaybe()/toString() before exporting.",
      storedField:
        "{{name}} on a stored field lets the fluent wrapper escape — call toResult()/toMaybe()/toString() before storing it.",
      serializeArg:
        "Passing a fluent(...) chain into {{sink}}() serializes/transfers a closure — call toResult()/toMaybe()/toString() first.",
    },
  },
  create(context) {
    return {
      TSTypeReference(/** @type {import('eslint').Rule.Node} */ node) {
        const typeRef = asTsTypeReference(node);
        const typeName = typeRef.typeName;
        if (typeName.type !== "Identifier" || !FLUENT_WRAPPER_TYPES.has(typeName.name ?? ""))
          return;
        const name = typeName.name;

        const annotation = asLoose(node).parent;
        if (annotation?.type !== "TSTypeAnnotation") return;
        const owner = annotation.parent;
        if (!owner) return;

        if (
          [
            "FunctionDeclaration",
            "FunctionExpression",
            "ArrowFunctionExpression",
            "TSMethodSignature",
            "TSDeclareFunction",
            "TSFunctionType",
            "TSCallSignatureDeclaration",
          ].includes(owner.type) &&
          owner.returnType === annotation
        ) {
          context.report({ node, messageId: "returnType", data: { name } });
          return;
        }

        // A variable's type annotation hangs off its `id` pattern, e.g.
        // `const chain: FluentResult<…>` attaches to the Identifier "chain",
        // whose parent is the VariableDeclarator.
        if (owner.type === "Identifier" && owner.parent?.type === "VariableDeclarator") {
          if (owner.parent.parent?.parent?.type === "ExportNamedDeclaration") {
            context.report({ node, messageId: "exported", data: { name } });
            return;
          }
        }

        if (owner.type === "PropertyDefinition" || owner.type === "TSPropertySignature") {
          context.report({ node, messageId: "storedField", data: { name } });
        }
      },
      CallExpression(node) {
        const sink = calleeName(asLoose(node.callee));
        if (!FLUENT_ESCAPE_SINKS.has(sink)) return;
        for (const arg of node.arguments) {
          if (isFluentChain(arg)) {
            context.report({ node: arg, messageId: "serializeArg", data: { sink } });
          }
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
    "no-deprecated-synonyms": noDeprecatedSynonyms,
    "fluent-stays-local": fluentStaysLocal,
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
      "@onrails/result/no-deprecated-synonyms": "warn",
      "@onrails/result/fluent-stays-local": "warn",
    },
  },
};
