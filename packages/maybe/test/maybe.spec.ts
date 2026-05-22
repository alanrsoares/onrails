import { describe, expect, it } from "bun:test";
import {
  andThen,
  compact,
  flatMapMaybe,
  fromNullable,
  fromThrowable,
  getOrElse,
  isNone,
  isSome,
  mapMaybe,
  match,
  none,
  of,
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

  it("fromThrowable", () => {
    const m = fromThrowable(() => 1);
    expect(isSome(m) && m.value).toBe(1);
    expect(
      isNone(
        fromThrowable(() => {
          throw new Error("boom");
        }),
      ),
    ).toBe(true);
  });

  it("map / flatMap / andThen", () => {
    const mapped = mapMaybe(some(2), (n) => n + 1);
    expect(isSome(mapped) && mapped.value).toBe(3);
    expect(isNone(mapMaybe(none<number>(), (n) => n + 1))).toBe(true);
    const chained = flatMapMaybe(some(2), (n) => some(String(n)));
    expect(isSome(chained) && chained.value).toBe("2");
    expect(isNone(andThen(none<number>(), () => some("x")))).toBe(true);
  });

  it("match", () => {
    expect(
      match(some(1), {
        some: (v) => v + 1,
        none: () => 0,
      }),
    ).toBe(2);
    expect(
      match(none<number>(), {
        some: () => 1,
        none: () => 0,
      }),
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
});
