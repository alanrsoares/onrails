import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import { flatMap, Maybe, map, match, none, some, tap, tapNone, unwrapOr } from "../src/index.js";
import { arbFn, arbMaybe } from "./helpers/arbitraries.js";

const METHODS = ["map", "flatMap", "andThen", "match", "unwrapOr", "tap", "tapNone"] as const;

const toData = <T>(m: Maybe<T>) =>
  m._tag === "Some" ? { _tag: "Some", value: m.value } : { _tag: "None" };

describe("prototype core: shape", () => {
  it("own enumerable keys are only the tag and the payload", () => {
    expect(Object.keys(some(1))).toEqual(["_tag", "value"]);
    expect(Object.keys(none())).toEqual(["_tag"]);
  });

  it.each(METHODS.map((name) => ({ name })))(
    "$name is on the prototype, not enumerable",
    ({ name }) => {
      expect(typeof some(1)[name]).toBe("function");
      expect(Object.hasOwn(some(1), name)).toBe(false);
      expect(Object.keys(none())).not.toContain(name);
    },
  );

  it("JSON output is exactly the plain-data shape", () => {
    expect(JSON.stringify(some({ a: 1 }))).toBe('{"_tag":"Some","value":{"a":1}}');
    expect(JSON.stringify(none())).toBe('{"_tag":"None"}');
  });
});

describe("prototype core: methods agree with the module functions", () => {
  it("map / flatMap / andThen / match / unwrapOr", () => {
    fc.assert(
      fc.property(arbMaybe, arbFn, (m, f) => {
        expect(toData(m.map(f))).toEqual(toData(map(m, f)));
        expect(toData(m.flatMap((n) => some(f(n))))).toEqual(toData(flatMap(m, (n) => some(f(n)))));
        expect(toData(m.andThen((n) => some(f(n))))).toEqual(toData(flatMap(m, (n) => some(f(n)))));
        expect(m.match(f, () => 0)).toBe(match(m, f, () => 0));
        expect(m.unwrapOr(-1)).toBe(unwrapOr(m, -1));
      }),
    );
  });

  it("tap and tapNone observe one branch, return the same carrier, and do not swallow throws", () => {
    const seen: string[] = [];
    const s = some(1);
    expect(s.tap(() => seen.push("some"))).toBe(s);
    expect(s.tapNone(() => seen.push("none"))).toBe(s);
    expect(tap(s, () => seen.push("some2"))).toBe(s);
    expect(tapNone(s, () => seen.push("none2"))).toBe(s);
    const n = none<number>();
    expect(n.tapNone(() => seen.push("none3"))).toBe(n);
    expect(seen).toEqual(["some", "some2", "none3"]);
    expect(() =>
      some(1).tap(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });
});

describe("prototype core: serialization boundary", () => {
  it("Maybe.from restores a working carrier from every plain-data route", () => {
    fc.assert(
      fc.property(arbMaybe, arbFn, (m, f) => {
        for (const wire of [structuredClone(m), JSON.parse(JSON.stringify(m)), { ...m }]) {
          expect(Object.getPrototypeOf(wire)).toBe(Object.prototype);
          expect(typeof wire.map).toBe("undefined");
          const live = Maybe.from<number>(wire);
          expect(toData(live)).toEqual(toData(m));
          expect(toData(live.map(f))).toEqual(toData(map(m, f)));
        }
      }),
    );
  });

  it("a hand-written literal is not a Maybe", () => {
    // @ts-expect-error a literal has no methods; build with some()/none() or lift with Maybe.from
    const bad: Maybe<number> = { _tag: "Some", value: 1 };
    expect(typeof bad.map).toBe("undefined");
  });
});
