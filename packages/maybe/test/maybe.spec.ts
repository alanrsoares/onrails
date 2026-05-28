import { describe, expect, it } from "bun:test";
import {
  andThen,
  compact,
  compactMap,
  flatMap,
  fromNullable,
  getOrElse,
  isNone,
  isSome,
  map,
  match,
  none,
  of,
  optional,
  some,
  unwrap,
  unwrapOr,
} from "../src/maybe.js";

describe("Maybe", () => {
  it("some / none / of tags", () => {
    expect(some(1)._tag).toBe("Some");
    expect(none()._tag).toBe("None");
    expect(of(2)._tag).toBe("Some");
  });

  it("fromNullable", () => {
    expect(isSome(fromNullable("x"))).toBe(true);
    expect(isNone(fromNullable(null))).toBe(true);
    expect(isNone(fromNullable(undefined))).toBe(true);
  });

  it("map / flatMap / andThen", () => {
    const mapped = map(some(2), (n) => n + 1);
    expect(isSome(mapped) && mapped.value).toBe(3);
    expect(isNone(map(none<number>(), (n) => n + 1))).toBe(true);
    const chained = flatMap(some(2), (n) => some(String(n)));
    expect(isSome(chained) && chained.value).toBe("2");
    expect(isNone(andThen(none<number>(), () => some("x")))).toBe(true);
  });

  it("match", () => {
    expect(
      match(
        some(1),
        (v) => v + 1,
        () => 0,
      ),
    ).toBe(2);
    expect(
      match(
        none<number>(),
        () => 1,
        () => 0,
      ),
    ).toBe(0);
  });

  it("getOrElse / unwrapOr / unwrap", () => {
    expect(getOrElse(some(1), 0)).toBe(1);
    expect(unwrapOr(none<number>(), 0)).toBe(0);
    expect(unwrap(some("ok"))).toBe("ok");
    expect(() => unwrap(none())).toThrow("Called unwrap on None");
  });

  it("compact drops None", () => {
    expect(compact([some(1), none(), some(2)])).toEqual([1, 2]);
  });

  it("compactMap maps then compacts", () => {
    expect(compactMap([1, 2, 3], (n) => (n % 2 === 0 ? some(n) : none<number>()))).toEqual([2]);
  });

  it("optional lifts nullable then binds", () => {
    expect(optional("x", (s) => some(s.length))).toEqual(some(1));
    expect(optional(null, (s) => some(s))).toEqual(none());
  });
});
