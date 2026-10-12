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

/**
 * Carrier types and deserialization sinks. Hand-copied from `@onrails/codemod`
 * `src/boundary-spec.ts` (cross-package imports forbidden);
 * `packages/codemod/test/boundary-conformance.spec.ts` keeps copies in sync.
 */
const CARRIER_TYPES = new Set(["Result", "Maybe"]);
const CARRIER_SINKS = new Set(["JSON.parse", "structuredClone"]);
const CARRIER_SINK_METHODS = new Set(["json"]);

/**
 * Loose expression shape for the sink walk (`await`, `as`, parens, calls).
 *
 * @typedef {object} LooseExpr
 * @property {string} type
 * @property {string} [name]
 * @property {LooseExpr} [argument]
 * @property {LooseExpr} [expression]
 * @property {LooseExpr} [callee]
 * @property {LooseExpr} [object]
 * @property {LooseExpr} [property]
 * @property {LooseExpr} [typeAnnotation]
 * @property {LooseExpr} [typeName]
 */

/**
 * True when the expression is a deserialization sink call, looking through
 * `await` and `as` wrappers: `JSON.parse(x)`, `structuredClone(x)`, `res.json()`.
 *
 * @param {LooseExpr | null | undefined} node
 * @returns {boolean}
 */
const isSinkCall = (node) => {
  if (!node) return false;
  if (node.type === "AwaitExpression") return isSinkCall(node.argument);
  if (node.type === "TSAsExpression" || node.type === "TSNonNullExpression") {
    return isSinkCall(node.expression);
  }
  if (node.type !== "CallExpression" || !node.callee) return false;
  const callee = node.callee;
  if (callee.type === "MemberExpression" && callee.property?.name) {
    if (CARRIER_SINK_METHODS.has(callee.property.name)) return true;
    return CARRIER_SINKS.has(`${callee.object?.name}.${callee.property.name}`);
  }
  return callee.type === "Identifier" && CARRIER_SINKS.has(callee.name ?? "");
};

/**
 * @param {LooseExpr | null | undefined} typeNode
 * @returns {boolean}
 */
const isCarrierType = (typeNode) =>
  typeNode?.type === "TSTypeReference" &&
  typeNode.typeName?.type === "Identifier" &&
  CARRIER_TYPES.has(typeNode.typeName.name ?? "");

/**
 * `Promise<Result<…>>` / `Promise<Maybe<…>>` or a bare carrier: what an `async` function annotated
 * with a carrier return type looks like.
 *
 * @param {LooseExpr | null | undefined} typeNode
 * @returns {boolean}
 */
const isCarrierReturn = (typeNode) => {
  if (isCarrierType(typeNode)) return true;
  if (typeNode?.type !== "TSTypeReference" || typeNode.typeName?.name !== "Promise") return false;
  const args = /** @type {{ params?: LooseExpr[] }} */ (
    /** @type {{ typeArguments?: unknown; typeParameters?: unknown }} */ (typeNode).typeArguments ??
      /** @type {{ typeParameters?: unknown }} */ (typeNode).typeParameters
  );
  return isCarrierType(args?.params?.[0]);
};

/**
 * The sink call, or an identifier that resolves to a `const` initialised from one:
 * `const x = JSON.parse(s); return x;`.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {LooseExpr | null | undefined} node
 * @returns {boolean}
 */
const isSinkValue = (context, node) => {
  if (isSinkCall(node)) return true;
  if (node?.type !== "Identifier") return false;
  for (
    let scope = context.sourceCode.getScope(/** @type {never} */ (node));
    scope;
    scope = /** @type {typeof scope} */ (scope.upper)
  ) {
    const variable = scope.set.get(node.name ?? "");
    if (!variable) continue;
    const def = variable.defs[0];
    const declarator =
      /** @type {{ id?: LooseExpr; init?: LooseExpr | null; parent?: { kind?: string } } | undefined} */ (
        def?.node
      );
    return (
      def?.type === "Variable" &&
      declarator?.parent?.kind === "const" &&
      declarator.id?.type === "Identifier" &&
      isSinkCall(declarator.init)
    );
  }
  return false;
};

/** `res.json<Result<…>>()`: the carrier is named through the call's type argument. */
const hasCarrierTypeArgument = (/** @type {LooseExpr} */ node) => {
  const call =
    /** @type {{ typeArguments?: { params?: LooseExpr[] }; typeParameters?: { params?: LooseExpr[] } }} */ (
      /** @type {unknown} */ (node)
    );
  return isCarrierType((call.typeArguments ?? call.typeParameters)?.params?.[0]);
};

// an `as Result<…>` / `as Maybe<…>` expression is already reported by the TSAsExpression
// visitor; any other cast (`as any`) must not hide the carrier type around it
const isCarrierCast = (/** @type {LooseExpr | null | undefined} */ e) =>
  e?.type === "TSAsExpression" && isCarrierType(e.typeAnnotation);

/**
 * Builds the check for a value flowing into a function's carrier-typed return.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {(node: import('eslint').Rule.Node) => void} report
 */
const returnCheck =
  (context, report) =>
  /**
   * @param {import('eslint').Rule.Node} fn
   * @param {import('eslint').Rule.Node} at
   * @param {LooseExpr | null | undefined} value
   */
  (fn, at, value) => {
    const returnType = /** @type {{ returnType?: { typeAnnotation?: LooseExpr } }} */ (
      /** @type {unknown} */ (fn)
    ).returnType?.typeAnnotation;
    if (isCarrierReturn(returnType) && !isCarrierCast(value) && isSinkValue(context, value)) {
      report(at);
    }
  };

/** @type {import('eslint').Rule.RuleModule} */
const carrierSinksNeedFrom = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow plain data from JSON.parse/structuredClone/.json() being typed as Result/Maybe without Result.from/Maybe.from.",
    },
    schema: [],
    messages: {
      needsFrom:
        "Data from JSON.parse/structuredClone/.json() is typed as Result/Maybe but carries no methods — lift it with Result.from / Maybe.from.",
    },
  },
  create(context) {
    /** @param {import('eslint').Rule.Node} node */
    const report = (node) => context.report({ node, messageId: "needsFrom" });
    const checkReturn = returnCheck(context, report);

    return {
      TSAsExpression(/** @type {import('eslint').Rule.Node} */ node) {
        const expr = /** @type {LooseExpr} */ (/** @type {unknown} */ (node));
        if (isCarrierType(expr.typeAnnotation) && isSinkValue(context, expr.expression)) {
          report(node);
        }
      },
      VariableDeclarator(/** @type {import('eslint').Rule.Node} */ node) {
        const decl =
          /** @type {{ id: { typeAnnotation?: { typeAnnotation: LooseExpr } }; init?: LooseExpr | null }} */ (
            /** @type {unknown} */ (node)
          );
        if (isCarrierCast(decl.init)) return;
        if (
          isCarrierType(decl.id.typeAnnotation?.typeAnnotation) &&
          isSinkValue(context, decl.init)
        ) {
          report(node);
        }
      },
      AssignmentPattern(/** @type {import('eslint').Rule.Node} */ node) {
        const pattern =
          /** @type {{ left: { typeAnnotation?: { typeAnnotation: LooseExpr } }; right: LooseExpr }} */ (
            /** @type {unknown} */ (node)
          );
        if (isCarrierCast(pattern.right)) return;
        if (
          isCarrierType(pattern.left.typeAnnotation?.typeAnnotation) &&
          isSinkValue(context, pattern.right)
        ) {
          report(node);
        }
      },
      ReturnStatement(/** @type {import('eslint').Rule.Node} */ node) {
        const stmt = /** @type {{ argument?: LooseExpr | null }} */ (/** @type {unknown} */ (node));
        const fn = context.sourceCode
          .getAncestors(node)
          .filter((a) => /Function/.test(a.type))
          .pop();
        // getAncestors is typed with estree nodes; every ancestor of a visited node is a rule node
        if (fn) checkReturn(/** @type {import('eslint').Rule.Node} */ (fn), node, stmt.argument);
      },
      ArrowFunctionExpression(/** @type {import('eslint').Rule.Node} */ node) {
        const arrow = /** @type {{ body: LooseExpr }} */ (/** @type {unknown} */ (node));
        if (arrow.body.type !== "BlockStatement") checkReturn(node, node, arrow.body);
      },
      CallExpression(/** @type {import('eslint').Rule.Node} */ node) {
        const call = /** @type {LooseExpr} */ (/** @type {unknown} */ (node));
        if (isSinkCall(call) && hasCarrierTypeArgument(call)) report(node);
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
    "carrier-sinks-need-from": carrierSinksNeedFrom,
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
      "@onrails/result/carrier-sinks-need-from": "warn",
    },
  },
};
