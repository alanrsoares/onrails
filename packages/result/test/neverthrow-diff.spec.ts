import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import * as nt from "neverthrow";
import * as shim from "../src/compat/neverthrow.js";

const names = (o: object): string[] =>
  Object.getOwnPropertyNames(o)
    .filter((n) => n !== "constructor" && n !== "prototype" && n !== "length" && n !== "name")
    .sort();

const missing = (reference: object, candidate: object): string[] => {
  const have = new Set(names(candidate));
  return names(reference).filter((n) => !have.has(n));
};

/**
 * Ratchet: members neverthrow has that the shim lacks today. Closing a gap
 * (issue #97, step 1d) makes the matching row fail until it is deleted here.
 */
const knownGaps = [
  {
    label: "module exports",
    actual: () => missing(nt, shim),
    expected: ["Err", "Ok", "default", "fromAsyncThrowable", "fromThrowable", "safeTry"],
  },
  {
    label: "Ok/Err instance members",
    actual: () => missing(Object.getPrototypeOf(nt.ok(1)), Object.getPrototypeOf(shim.ok(1))),
    expected: ["andTee", "andThrough", "asyncAndThrough", "asyncMap", "orTee", "safeUnwrap"],
  },
  {
    label: "ResultAsync instance members",
    actual: () => missing(nt.ResultAsync.prototype, shim.ResultAsync.prototype),
    expected: ["andThrough", "safeUnwrap"],
  },
  {
    label: "ResultAsync static members",
    actual: () => missing(nt.ResultAsync, shim.ResultAsync),
    expected: ["combineWithAllErrors"],
  },
  {
    label: "Result static members",
    actual: () => missing(nt.Result, shim.Result),
    expected: ["combineWithAllErrors"],
  },
];

describe("neverthrow surface diff", () => {
  it.each(knownGaps)(
    "$label: missing members match the known-gaps list",
    ({ actual, expected }) => {
      expect(actual()).toEqual(expected);
    },
  );
});

// A differential program is a start value plus a chain of ops, interpreted
// once against neverthrow and once against the shim. Callbacks are pure and
// derived from the op's `k` so both sides see identical behaviour.
type Op =
  | { readonly kind: "map"; readonly k: number }
  | { readonly kind: "mapErr"; readonly k: number }
  | { readonly kind: "andThenOk"; readonly k: number }
  | { readonly kind: "andThenErr"; readonly k: number }
  | { readonly kind: "orElseOk"; readonly k: number }
  | { readonly kind: "orElseErr"; readonly k: number };

type Program = {
  readonly start: { readonly ok: boolean; readonly n: number };
  readonly ops: readonly Op[];
};

type Outcome = { readonly tag: "Ok" | "Err"; readonly payload: number };

const arbOp: fc.Arbitrary<Op> = fc.record({
  kind: fc.constantFrom("map", "mapErr", "andThenOk", "andThenErr", "orElseOk", "orElseErr"),
  k: fc.integer({ min: -50, max: 50 }),
}) as fc.Arbitrary<Op>;

const arbProgram: fc.Arbitrary<Program> = fc.record({
  start: fc.record({ ok: fc.boolean(), n: fc.integer({ min: -50, max: 50 }) }),
  ops: fc.array(arbOp, { maxLength: 8 }),
});

/** Both libraries' Result-like instances share this method subset. */
type Chain = {
  map(fn: (n: number) => number): Chain;
  mapErr(fn: (n: number) => number): Chain;
  andThen(fn: (n: number) => Chain): Chain;
  orElse(fn: (n: number) => Chain): Chain;
  match<A>(onOk: (n: number) => A, onErr: (n: number) => A): A;
};

type Lib = {
  readonly ok: (n: number) => Chain;
  readonly err: (n: number) => Chain;
};

const interpret = (lib: Lib, { start, ops }: Program): Outcome => {
  let cur = start.ok ? lib.ok(start.n) : lib.err(start.n);
  for (const op of ops) {
    const k = op.k;
    switch (op.kind) {
      case "map":
        cur = cur.map((n) => n + k);
        break;
      case "mapErr":
        cur = cur.mapErr((n) => n * 2 + k);
        break;
      case "andThenOk":
        cur = cur.andThen((n) => lib.ok(n - k));
        break;
      case "andThenErr":
        cur = cur.andThen((n) => lib.err(n - k));
        break;
      case "orElseOk":
        cur = cur.orElse((n) => lib.ok(n + k));
        break;
      case "orElseErr":
        cur = cur.orElse((n) => lib.err(n + k));
        break;
    }
  }
  return cur.match<Outcome>(
    (payload) => ({ tag: "Ok", payload }),
    (payload) => ({ tag: "Err", payload }),
  );
};

const ntLib: Lib = { ok: (n) => nt.ok(n), err: (n) => nt.err(n) };
const shimLib: Lib = { ok: (n) => shim.ok(n), err: (n) => shim.err(n) };

describe("neverthrow differential (sync)", () => {
  it("random op chains produce identical outcomes", () => {
    fc.assert(
      fc.property(arbProgram, (program) => {
        expect(interpret(shimLib, program)).toEqual(interpret(ntLib, program));
      }),
    );
  });

  it("ok(1).map(f).unwrapOr(0) agrees", () => {
    const f = (n: number): number => n + 1;
    expect(shim.ok<number, string>(1).map(f).unwrapOr(0)).toBe(
      nt.ok<number, string>(1).map(f).unwrapOr(0),
    );
  });
});
