/**
 * boundary-spec.ts — the single owning module for the boundary idioms
 * onrails enforces on consumers:
 *
 * 1. no `Promise<Result<…>>` in public signatures (`no-promise-result`)
 * 2. no unsafe unwraps outside tests (`no-unsafe-unwrap`)
 * 3. no deprecated neverthrow-era synonyms (`no-deprecated-synonyms`)
 *
 * The ESLint plugin (plain JS, `packages/eslint-plugin/src/index.js`) and the
 * Biome plugin (GritQL, `packages/biome-plugin/rules/*.grit`) cannot import
 * this module — cross-package imports are forbidden — so they hand-copy the
 * names. `packages/codemod/test/boundary-conformance.spec.ts` reads those
 * artifacts off disk and asserts they stay in sync with this spec.
 *
 * Deliberate per-engine divergences are declared in `ENGINE_DIVERGENCES`;
 * anything not declared there is drift.
 */

// ---------------------------------------------------------------------------
// Unsafe unwraps
// ---------------------------------------------------------------------------

/**
 * neverthrow-compat unsafe-unwrap methods → native named equivalents.
 * The codemod rewrites `r._unsafeUnwrap()` to `unwrapOk(r)`; the natives are
 * still unsafe (throw on the wrong branch) and stay lint-flagged.
 */
export const UNSAFE_UNWRAP_MEMBER_RENAMES: ReadonlyMap<string, string> = new Map([
  ["_unsafeUnwrap", "unwrapOk"],
  ["_unsafeUnwrapErr", "unwrapErr"],
]);

/** Free-function unwraps that throw on the unhappy branch. */
export const UNSAFE_UNWRAP_CALL_NAMES = ["unwrapOk", "unwrapErr", "unwrap"] as const;

/** Every identifier the `no-unsafe-unwrap` rule flags, across engines. */
export const UNSAFE_UNWRAP_NAMES: ReadonlySet<string> = new Set([
  ...UNSAFE_UNWRAP_MEMBER_RENAMES.keys(),
  ...UNSAFE_UNWRAP_CALL_NAMES,
]);

/**
 * Matches compat unsafe-unwrap member calls (`._unsafeUnwrap(` /
 * `._unsafeUnwrapErr(`) in raw source. Derived from the rename map so the
 * codemod's compat-only detection cannot drift from the spec.
 */
export const UNSAFE_UNWRAP_MEMBER_CALL_RE = new RegExp(
  String.raw`\.(?:${[...UNSAFE_UNWRAP_MEMBER_RENAMES.keys()].join("|")})\s*\(`,
);

// ---------------------------------------------------------------------------
// Deprecated synonyms
// ---------------------------------------------------------------------------

export interface DeprecatedSynonym {
  /** The deprecated identifier as it appears in consumer code. */
  readonly name: string;
  /** `method` — flagged as `x.name(…)`; `call` — flagged as `name(…)`. */
  readonly form: "method" | "call";
  /** Canonical replacement identifier. */
  readonly canonical: string;
  /** Extra guidance when the rename is not a plain identifier swap. */
  readonly hint?: string;
}

/**
 * Deprecated neverthrow/fp-era synonyms → canonical onrails names.
 * Matching is name-based in every engine — neither GritQL nor the ESLint
 * rules scope by import, so same-named calls from other libraries (RxJS
 * `of`, fp-ts `fold`) are flagged too.
 */
export const DEPRECATED_SYNONYMS: readonly DeprecatedSynonym[] = [
  { name: "chain", form: "method", canonical: "flatMap" },
  {
    name: "isOk",
    form: "method",
    canonical: "isOk",
    hint: "await the ResultAsync, then narrow with the isOk() free function",
  },
  {
    name: "isErr",
    form: "method",
    canonical: "isErr",
    hint: "await the ResultAsync, then narrow with the isErr() free function",
  },
  { name: "fold", form: "call", canonical: "match" },
  { name: "matchResult", form: "call", canonical: "match" },
  { name: "matchMaybe", form: "call", canonical: "match" },
  { name: "getOrElse", form: "call", canonical: "unwrapOr" },
  { name: "sequenceTupleAsync", form: "call", canonical: "ResultAsync.combineTuple" },
  { name: "collect", form: "call", canonical: "combine" },
  { name: "of", form: "call", canonical: "ok", hint: "or some() for Maybe" },
];

/** Flat old-name → canonical-name view of {@link DEPRECATED_SYNONYMS}. */
export const DEPRECATED_SYNONYM_RENAMES: ReadonlyMap<string, string> = new Map(
  DEPRECATED_SYNONYMS.map((s) => [s.name, s.canonical]),
);

// ---------------------------------------------------------------------------
// Rule descriptors
// ---------------------------------------------------------------------------

/** `Promise<Result<…>>` in a type position → `ResultAsync<T, E>`. */
export const NO_PROMISE_RESULT_RULE = {
  id: "no-promise-result",
  replacement: "ResultAsync",
  boundaryHelpers: ["fromAsync", "tryAsync"],
  message:
    "Promise<Result<…>> in a type position — use ResultAsync<T, E> at the boundary (fromAsync / tryAsync).",
} as const;

/** Unsafe unwraps outside tests. Message is shared verbatim by both engines. */
export const NO_UNSAFE_UNWRAP_RULE = {
  id: "no-unsafe-unwrap",
  message:
    "Avoid _unsafeUnwrap* and unwrap* outside tests — use match(), resolve(), or yieldResult() in tryGen.",
} as const;

/** Deprecated synonym identifiers. Per-engine message wording differs. */
export const NO_DEPRECATED_SYNONYMS_RULE = {
  id: "no-deprecated-synonyms",
} as const;

// ---------------------------------------------------------------------------
// Declared divergences
// ---------------------------------------------------------------------------

export interface EngineDivergence {
  readonly rule: string;
  /** Engine whose behaviour differs from the other(s). */
  readonly engine: "eslint" | "biome" | "codemod";
  /** Stable id the conformance test keys on. */
  readonly divergence: string;
  readonly detail: string;
}

/**
 * Deliberate cross-engine behaviour differences. The conformance test treats
 * these as declared (allowed); any other difference is accidental drift.
 */
export const ENGINE_DIVERGENCES: readonly EngineDivergence[] = [
  {
    rule: "no-unsafe-unwrap",
    engine: "biome",
    divergence: "no-test-file-exemption",
    detail:
      "The ESLint rule skips *.spec.* / *.test.* files where unsafe unwraps are " +
      "acceptable; GritQL patterns cannot read the file path, so the Biome rule " +
      "flags test code too. Suppress with a biome-ignore comment or a linter " +
      "override for test globs.",
  },
];
