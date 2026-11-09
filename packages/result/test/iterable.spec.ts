import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { combine, validateAll } from "../src/collections.js";
import { allOk } from "../src/extra.js";
import { err, ok, type Result } from "../src/result.js";
import { arbResult } from "./helpers/arbitraries.js";

function* gen<T>(items: readonly T[]): Generator<T> {
  yield* items;
}

const counting = <T>(items: readonly T[]) => {
  const state = { pulled: 0 };
  const iterable: Iterable<T> = {
    *[Symbol.iterator]() {
      for (const item of items) {
        state.pulled += 1;
        yield item;
      }
    },
  };
  return { iterable, state };
};

describe("iterable input matches array input", () => {
  it.each([
    { label: "combine", f: (rs: Iterable<Result<number, string>>) => combine(rs) },
    { label: "validateAll", f: (rs: Iterable<Result<number, string>>) => validateAll(rs) },
    {
      label: "validateAll with combineErrors",
      f: (rs: Iterable<Result<number, string>>) => validateAll(rs, (a, b) => a + b),
    },
    { label: "allOk", f: (rs: Iterable<Result<number, string>>) => allOk(rs) },
  ])("$label", ({ f }) => {
    fc.assert(fc.property(fc.array(arbResult), (rs) => expect(f(gen(rs))).toEqual(f(rs))));
  });
});

describe("early stop at the first Err", () => {
  const rs: Result<number, string>[] = [ok(1), err("e"), ok(3), ok(4)];

  it.each([
    { label: "combine", run: (xs: Iterable<Result<number, string>>) => combine(xs) },
    { label: "allOk", run: (xs: Iterable<Result<number, string>>) => allOk(xs) },
  ])("$label pulls up to the Err only", ({ run }) => {
    const { iterable, state } = counting(rs);
    run(iterable);
    expect(state.pulled).toBe(2);
  });
});
