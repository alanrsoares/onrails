import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { at, compact, compactMap, find, head, last, none, some } from "../src/maybe.js";
import { arbMaybe } from "./helpers/arbitraries.js";

function* gen<T>(items: readonly T[]): Generator<T> {
  yield* items;
}

/** Counts how many elements a consumer pulls before it stops. */
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
  it("compact", () => {
    fc.assert(
      fc.property(fc.array(arbMaybe), (ms) => expect(compact(gen(ms))).toEqual(compact(ms))),
    );
  });

  it("compactMap", () => {
    const evenHalf = (n: number) => (n % 2 === 0 ? some(n / 2) : none<number>());
    fc.assert(
      fc.property(fc.array(fc.integer()), (ns) =>
        expect(compactMap(gen(ns), evenHalf)).toEqual(compactMap(ns, evenHalf)),
      ),
    );
  });

  it.each([
    { label: "head", f: head },
    { label: "last", f: last },
  ])("$label", ({ f }) => {
    fc.assert(fc.property(fc.array(fc.integer()), (ns) => expect(f(gen(ns))).toEqual(f(ns))));
  });

  it("find", () => {
    const isNeg = (n: number) => n < 0;
    fc.assert(
      fc.property(fc.array(fc.integer()), (ns) =>
        expect(find(gen(ns), isNeg)).toEqual(find(ns, isNeg)),
      ),
    );
  });
});

describe("lookups", () => {
  it.each([
    { label: "head of empty", actual: head([]), expected: none() },
    { label: "head of one", actual: head(["a"]), expected: some("a") },
    { label: "head of Set", actual: head(new Set([7, 8])), expected: some(7) },
    { label: "last of empty", actual: last([]), expected: none() },
    { label: "last of many", actual: last([1, 2, 3]), expected: some(3) },
    {
      label: "last of Map keys",
      actual: last(
        new Map([
          ["a", 1],
          ["b", 2],
        ]).keys(),
      ),
      expected: some("b"),
    },
    { label: "at in range", actual: at(["a", "b"], 1), expected: some("b") },
    { label: "at negative", actual: at(["a", "b"], -1), expected: some("b") },
    { label: "at out of range", actual: at(["a", "b"], 2), expected: none() },
    { label: "at negative out of range", actual: at(["a", "b"], -3), expected: none() },
    { label: "at non-integer", actual: at(["a", "b"], 0.5), expected: none() },
    { label: "at undefined element", actual: at([undefined], 0), expected: some(undefined) },
    { label: "at curried", actual: at(-1)([1, 2]), expected: some(2) },
    { label: "find match", actual: find([1, 2, 3], (n) => n > 1), expected: some(2) },
    { label: "find no match", actual: find([1, 2, 3], (n) => n > 9), expected: none() },
    { label: "find curried", actual: find((n: number) => n > 1)([1, 2]), expected: some(2) },
  ])("$label", ({ actual, expected }) => {
    expect(actual).toEqual(expected);
  });

  it("at matches Array.prototype.at for every integer index", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer({ min: -10, max: 10 }), (ns, i) => {
        const expected = i >= -ns.length && i < ns.length ? some(ns.at(i) as number) : none();
        expect(at(ns, i)).toEqual(expected);
      }),
    );
  });
});

describe("early stop", () => {
  it.each([
    { label: "head pulls one", run: (xs: Iterable<number>) => head(xs), pulled: 1 },
    {
      label: "find stops at the match",
      run: (xs: Iterable<number>) => find(xs, (n) => n === 2),
      pulled: 2,
    },
  ])("$label", ({ run, pulled }) => {
    const { iterable, state } = counting([1, 2, 3, 4]);
    run(iterable);
    expect(state.pulled).toBe(pulled);
  });
});
