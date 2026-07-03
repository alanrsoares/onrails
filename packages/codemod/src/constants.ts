import { UNSAFE_UNWRAP_MEMBER_CALL_RE, UNSAFE_UNWRAP_MEMBER_RENAMES } from "./boundary-spec.js";

export const SKIP = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "build",
]);
export const CODE_EXT = /\.(ts|tsx|mts|cts)$/;
export const JSX_EXT = /\.(tsx|jsx)$/;
export const IMPORT_RE = /(from\s+|import\s*\(\s*)(['"])neverthrow\2/g;
export const COMPAT_SPEC = "@onrails/result/compat/neverthrow";
export const NATIVE_SPEC = "@onrails/result";
export const DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies"] as const;
export const TYPE_ONLY_NATIVE = new Set(["Result", "Ok", "Err", "UnexpectedError"]);
export const COMPAT_ONLY_PATTERNS = [
  { pattern: /\bResult\.(combine|fromThrowable)\b/, label: "Result static helper" },
  { pattern: UNSAFE_UNWRAP_MEMBER_CALL_RE, label: "unsafe compat unwrap" },
] as const;
export const RESULT_SPECIFIC_CHAIN_METHODS = new Set([
  "andThen",
  "chain",
  "flatMap",
  "mapErr",
  "orElse",
  "recover",
  "tapErr",
  "match",
  "unwrapOr",
]);
export const CHAIN_METHODS = new Map([
  ["map", "map"],
  ["mapErr", "mapErr"],
  ["andThen", "flatMap"],
  ["chain", "flatMap"],
  ["flatMap", "flatMap"],
  ["orElse", "recover"],
  ["recover", "recover"],
  ["tap", "tap"],
  ["tapErr", "tapErr"],
]);
export const TERMINAL_METHODS = new Set(["match", "unwrapOr"]);
export const ASYNC_ROOT_HINTS = [
  "ResultAsync",
  "okAsync",
  "errAsync",
  "fromPromise",
  "fromSafePromise",
];
export const ZERO_ARG_HELPERS = new Map([
  ["ok", "ok(undefined)"],
  ["okAsync", "okAsync(undefined)"],
]);
export const TEE_METHODS = new Map([
  ["andTee", "tap"],
  ["orTee", "tapErr"],
]);
export const PREDICATE_METHODS = new Set(["isOk", "isErr"]);
export const UNSAFE_UNWRAP_METHODS = new Map(UNSAFE_UNWRAP_MEMBER_RENAMES);
export const SAFE_BASE_PATTERNS = [/^(ok|err)\s*\(/, /^Result\./, /^[a-zA-Z_$][\w$]*$/] as const;
