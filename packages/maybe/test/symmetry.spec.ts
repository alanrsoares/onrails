import { describe, expect, it } from "bun:test";

import * as R from "@onrails/result";
import * as M from "../src/index.js";

/**
 * Cross-carrier symmetry contract (RFC 0002 §7): same operation ⇒ same name
 * ⇒ same dual-form arity on every carrier; channels mirror
 * (tapErr ↔ tapNone). Deliberate asymmetries are DECLARED below and asserted
 * in both directions, so silently closing (or widening) a gap fails here
 * until the declaration is updated.
 */

describe("symmetry: shared ops — same name, same dual arity, both carriers", () => {
  it("of ≡ pure constructor on both", () => {
    expect(R.of(1)).toEqual(R.ok(1));
    expect(M.of(1)).toEqual(M.some(1));
  });

  it("map — dual arity 2 on both", () => {
    const f = (n: number) => n + 1;
    expect(R.map(R.ok<number, string>(1), f)).toEqual(R.map(f)(R.ok<number, string>(1)));
    expect(M.map(M.some(1), f)).toEqual(M.map(f)(M.some(1)));
    expect(R.map(R.ok<number, string>(1), f)._tag).toBe("Ok");
    expect(M.map(M.some(1), f)._tag).toBe("Some");
  });

  it("flatMap (+ andThen alias) — dual arity 2 on both", () => {
    const fr = (n: number) => (n > 0 ? R.ok<number, string>(n) : R.err<number, string>("neg"));
    const fm = (n: number) => (n > 0 ? M.some(n) : M.none<number>());
    expect(R.flatMap(R.ok<number, string>(1), fr)).toEqual(R.flatMap(fr)(R.ok<number, string>(1)));
    expect(M.flatMap(M.some(1), fm)).toEqual(M.flatMap(fm)(M.some(1)));
    expect(M.andThen).toBe(M.flatMap);
  });

  it("match — dual arity 3 on both, mirrored handler channels", () => {
    const onHit = (n: number) => `hit:${n}`;
    const onMiss = () => "miss";
    expect(R.match(R.ok<number, string>(1), onHit, onMiss)).toBe("hit:1");
    expect(R.match(onHit, onMiss)(R.err<number, string>("e"))).toBe("miss");
    expect(M.match(M.some(1), onHit, onMiss)).toBe("hit:1");
    expect(M.match(onHit, onMiss)(M.none<number>())).toBe("miss");
  });

  it("unwrapOr — dual arity 2 on both", () => {
    expect(R.unwrapOr(R.err<number, string>("e"), 0)).toBe(0);
    expect(R.unwrapOr(0)(R.ok<number, string>(1))).toBe(1);
    expect(M.unwrapOr(M.none<number>(), 0)).toBe(0);
    expect(M.unwrapOr(0)(M.some(1))).toBe(1);
  });
});

describe("symmetry: channel mirrors, guards, show", () => {
  it("tap — success channel; tapErr ↔ tapNone mirror the failure/absence channel", () => {
    const log: string[] = [];
    R.tap(R.ok<number, string>(1), (n) => {
      log.push(`r-ok:${n}`);
    });
    M.tap(M.some(1), (n) => {
      log.push(`m-some:${n}`);
    });
    R.tapErr(R.err<number, string>("e"), (e) => {
      log.push(`r-err:${e}`);
    });
    M.tapNone(M.none(), () => {
      log.push("m-none");
    });
    expect(log).toEqual(["r-ok:1", "m-some:1", "r-err:e", "m-none"]);
  });

  it("guards mirror: isOk/isErr ↔ isSome/isNone", () => {
    expect(R.isOk(R.ok(1))).toBe(true);
    expect(R.isErr(R.err("e"))).toBe(true);
    expect(M.isSome(M.some(1))).toBe(true);
    expect(M.isNone(M.none())).toBe(true);
  });

  it("show — tag-wrapped debug print on both", () => {
    expect(R.show(R.ok(1))).toBe("Ok(1)");
    expect(M.show(M.some(1))).toBe("Some(1)");
    expect(M.show(M.none())).toBe("None");
  });
});

describe("symmetry: declared asymmetries (update the declaration to close a gap)", () => {
  // Each entry: [reason, has-side value, missing-side lookup]
  const cases: readonly [string, unknown, unknown][] = [
    // Maybe has one payload channel, so its assertion helper is bare `unwrap`;
    // result's is `unwrapOk` (with unwrapErr for the other channel).
    ["assertion tier naming", R.unwrapOk, (M as Record<string, unknown>).unwrapOk],
    ["assertion tier naming (maybe side)", M.unwrap, (R as Record<string, unknown>).unwrapNone],
    // None carries no payload — nothing for bimap/mapErr/recover to transform.
    ["bimap is result-only", R.bimap, (M as Record<string, unknown>).bimap],
    ["mapErr is result-only", R.mapErr, (M as Record<string, unknown>).mapErr],
    ["recover is result-only", R.recover, (M as Record<string, unknown>).recover],
    // pipe/flow live in the result package and are carrier-generic.
    ["pipe lives in result", R.pipe, (M as Record<string, unknown>).pipe],
    // Nullable-boundary constructors are maybe-only by design.
    ["fromNullable is maybe-only", M.fromNullable, (R as Record<string, unknown>).fromNullable],
    ["compact is maybe-only", M.compact, (R as Record<string, unknown>).compact],
  ];

  it.each(
    cases.map(([reason, has, missing]) => [reason, has, missing] as const),
  )("%s", (_reason, has, missing) => {
    expect(has).toBeDefined();
    expect(missing).toBeUndefined();
  });
});
