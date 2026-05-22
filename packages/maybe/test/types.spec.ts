import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import {
  type andThen,
  flatMapMaybe,
  fromNullable,
  mapMaybe,
  match,
  none,
  type of,
  some,
  unwrapOr,
} from "../src/maybe.js";
import type { Maybe } from "../src/types.js";

describe("Maybe types", () => {
  it("tags infer Maybe variants", () => {
    const s = some(1);
    const n = none<string>();
    expectType<TypeEqual<typeof s, Maybe<number>>>(true);
    expectType<TypeEqual<typeof n, Maybe<string>>>(true);
  });

  it("mapMaybe changes inner type", () => {
    const m = mapMaybe(some(1), (n) => String(n));
    type Out = typeof m;
    expectType<TypeEqual<Out, Maybe<string>>>(true);
  });

  it("flatMapMaybe unions inner types", () => {
    const m = flatMapMaybe(some(1), (n) => (n > 0 ? some(String(n)) : none()));
    type Out = typeof m;
    expectType<TypeEqual<Out, Maybe<string>>>(true);
  });

  it("andThen is flatMapMaybe", () => {
    expectType<TypeEqual<typeof andThen, typeof flatMapMaybe>>(true);
  });

  it("of is some", () => {
    expectType<TypeEqual<typeof of, typeof some>>(true);
  });

  it("fromNullable strips null and undefined", () => {
    const m = fromNullable("x" as string | null);
    type Out = typeof m;
    expectType<TypeEqual<Out, Maybe<string>>>(true);
  });

  it("match preserves handler return type", () => {
    const out = match(some(1), {
      some: (v) => v + 1,
      none: () => 0,
    });
    expectType<TypeEqual<typeof out, number>>(true);
  });

  it("unwrapOr returns default type on None", () => {
    const v = unwrapOr(none<number>(), 0);
    expectType<TypeEqual<typeof v, number>>(true);
  });
});
