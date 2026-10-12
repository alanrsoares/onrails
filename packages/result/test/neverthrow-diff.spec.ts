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

const surfaces = [
  // neverthrow's `default` bundle is skipped on purpose: a default export next to the named ones
  // changes how CJS consumers resolve the shim (tsup warns), and every member is also named.
  {
    label: "module exports",
    missing: () => missing(nt, shim).filter((name) => name !== "default"),
  },
  {
    label: "Ok/Err instance members",
    missing: () => missing(Object.getPrototypeOf(nt.ok(1)), Object.getPrototypeOf(shim.ok(1))),
  },
  {
    label: "ResultAsync instance members",
    missing: () => missing(nt.ResultAsync.prototype, shim.ResultAsync.prototype),
  },
  { label: "ResultAsync static members", missing: () => missing(nt.ResultAsync, shim.ResultAsync) },
  { label: "Result static members", missing: () => missing(nt.Result, shim.Result) },
];

describe("neverthrow surface diff", () => {
  it.each(surfaces)("$label: shim covers every neverthrow member", ({ missing }) => {
    expect(missing()).toEqual([]);
  });
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
  | { readonly kind: "orElseErr"; readonly k: number }
  | { readonly kind: "andTee"; readonly k: number }
  | { readonly kind: "orTee"; readonly k: number }
  | { readonly kind: "andThroughOk"; readonly k: number }
  | { readonly kind: "andThroughErr"; readonly k: number };

type Program = {
  readonly start: { readonly ok: boolean; readonly n: number };
  readonly ops: readonly Op[];
};

type Outcome = { readonly tag: "Ok" | "Err"; readonly payload: number };

const arbOp: fc.Arbitrary<Op> = fc.record({
  kind: fc.constantFrom(
    "map",
    "mapErr",
    "andThenOk",
    "andThenErr",
    "orElseOk",
    "orElseErr",
    "andTee",
    "orTee",
    "andThroughOk",
    "andThroughErr",
  ),
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
  andTee(fn: (n: number) => unknown): Chain;
  orTee(fn: (n: number) => unknown): Chain;
  andThrough(fn: (n: number) => Chain): Chain;
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
      case "andTee":
        // a throwing tee must be swallowed identically by both libraries
        cur = cur.andTee((n) => {
          if (n % 2 === 0) throw new Error("tee");
        });
        break;
      case "orTee":
        cur = cur.orTee(() => {
          throw new Error("tee");
        });
        break;
      case "andThroughOk":
        cur = cur.andThrough((n) => lib.ok(n + k));
        break;
      case "andThroughErr":
        cur = cur.andThrough((n) => lib.err(n + k));
        break;
    }
  }
  return cur.match<Outcome>(
    (payload) => ({ tag: "Ok", payload }),
    (payload) => ({ tag: "Err", payload }),
  );
};

// Spec-only bridge: the two libraries' instance types are structurally close but not identical;
// the differential run itself is the check.
const ntLib: Lib = { ok: (n) => nt.ok(n) as any, err: (n) => nt.err(n) as any };
const shimLib: Lib = { ok: (n) => shim.ok(n) as any, err: (n) => shim.err(n) as any };

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

// Both libraries' async carriers resolve to an object with `match`; typed loosely on purpose.
const settle = async (r: PromiseLike<any>): Promise<Outcome> =>
  (await r).match(
    (payload: number) => ({ tag: "Ok", payload }),
    (payload: number) => ({ tag: "Err", payload }),
  );

describe("neverthrow differential (async methods)", () => {
  it.each([
    { label: "ok", start: true },
    { label: "err", start: false },
  ])("asyncMap on $label agrees", async ({ start }) => {
    const f = async (n: number): Promise<number> => n * 3;
    const a = start ? nt.ok<number, string>(2) : nt.err<number, string>("e");
    const b = start ? shim.ok<number, string>(2) : shim.err<number, string>("e");
    expect(await settle(b.asyncMap(f))).toEqual(await settle(a.asyncMap(f)));
  });

  it.each([
    { label: "passes through", through: "ok" },
    { label: "fails through", through: "err" },
  ])("asyncAndThrough $label agrees", async ({ through }) => {
    const ntFn = (n: number) =>
      through === "ok" ? nt.okAsync<number, string>(n) : nt.errAsync<number, string>("t");
    const shimFn = (n: number) =>
      through === "ok" ? shim.okAsync<number, string>(n) : shim.errAsync<number, string>("t");
    expect(await settle(shim.ok<number, string>(1).asyncAndThrough(shimFn))).toEqual(
      await settle(nt.ok<number, string>(1).asyncAndThrough(ntFn)),
    );
  });

  it.each([
    { label: "ok", fail: false },
    { label: "err", fail: true },
  ])("ResultAsync.andThrough on $label agrees", async ({ fail }) => {
    const ntFn = (n: number) => (fail ? nt.err<number, string>("t") : nt.ok<number, string>(n));
    const shimFn = (n: number) =>
      fail ? shim.err<number, string>("t") : shim.ok<number, string>(n);
    expect(await settle(shim.okAsync<number, string>(1).andThrough(shimFn))).toEqual(
      await settle(nt.okAsync<number, string>(1).andThrough(ntFn)),
    );
  });
});

describe("neverthrow differential (combine)", () => {
  it("combineWithAllErrors collects every error", async () => {
    const ntR = nt.Result.combineWithAllErrors([nt.ok(1), nt.err("a"), nt.err("b")]);
    const shimR = shim.Result.combineWithAllErrors([shim.ok(1), shim.err("a"), shim.err("b")]);
    expect(
      shimR.match(
        (v) => v,
        (e) => e,
      ),
    ).toEqual(
      ntR.match(
        (v) => v,
        (e) => e,
      ),
    );
    const ntA = nt.ResultAsync.combineWithAllErrors([nt.okAsync(1), nt.errAsync("a")]);
    const shimA = shim.ResultAsync.combineWithAllErrors([shim.okAsync(1), shim.errAsync("a")]);
    expect(
      await shimA.then((r) =>
        r.match(
          (v) => v,
          (e) => e,
        ),
      ),
    ).toEqual(
      await ntA.then((r) =>
        r.match(
          (v) => v,
          (e) => e,
        ),
      ),
    );
  });
});

describe("neverthrow differential (safeTry)", () => {
  it.each([
    { label: "all ok", fail: false },
    { label: "short-circuits on err", fail: true },
  ])("safeTry sync: $label", ({ fail }) => {
    const ntR = nt.safeTry(function* () {
      const a = yield* nt.ok<number, string>(1).safeUnwrap();
      const b = yield* (fail ? nt.err<number, string>("x") : nt.ok<number, string>(2)).safeUnwrap();
      return nt.ok<number, string>(a + b);
    });
    const shimR = shim.safeTry(function* () {
      const a = yield* shim.ok<number, string>(1).safeUnwrap();
      const b = yield* (
        fail ? shim.err<number, string>("x") : shim.ok<number, string>(2)
      ).safeUnwrap();
      return shim.ok<number, string>(a + b);
    });
    expect(
      shimR.match(
        (v) => v,
        (e) => e,
      ),
    ).toEqual(
      ntR.match(
        (v) => v,
        (e) => e,
      ),
    );
  });

  it.each([
    { label: "all ok", fail: false },
    { label: "short-circuits on err", fail: true },
  ])("safeTry async: $label", async ({ fail }) => {
    const ntR = nt.safeTry(async function* () {
      const a = yield* nt.okAsync<number, string>(1).safeUnwrap();
      const b = yield* (
        fail ? nt.errAsync<number, string>("x") : nt.okAsync<number, string>(2)
      ).safeUnwrap();
      return nt.ok<number, string>(a + b);
    });
    const shimR = shim.safeTry(async function* () {
      const a = yield* shim.okAsync<number, string>(1).safeUnwrap();
      const b = yield* (
        fail ? shim.errAsync<number, string>("x") : shim.okAsync<number, string>(2)
      ).safeUnwrap();
      return shim.ok<number, string>(a + b);
    });
    expect(await settle(shimR)).toEqual(await settle(ntR));
  });
});

describe("neverthrow differential (Ok / Err classes)", () => {
  it("Ok / Err support instanceof and construction", () => {
    expect(shim.ok(1) instanceof shim.Ok).toBe(true);
    expect(shim.err("e") instanceof shim.Err).toBe(true);
    expect(shim.err("e") instanceof shim.Ok).toBe(false);
    expect(new shim.Ok<number, string>(1).unwrapOr(0)).toBe(1);
    expect(new shim.Err<number, string>("e").unwrapOr(0)).toBe(0);
  });
});
