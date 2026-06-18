import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import {
  type andThen,
  flatMap,
  fromNullable,
  map,
  match,
  none,
  some,
  tap,
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

  it("map changes inner type", () => {
    const m = map(some(1), (n) => String(n));
    type Out = typeof m;
    expectType<TypeEqual<Out, Maybe<string>>>(true);
  });

  it("flatMap unions inner types", () => {
    const m = flatMap(some(1), (n) => (n > 0 ? some(String(n)) : none()));
    type Out = typeof m;
    expectType<TypeEqual<Out, Maybe<string>>>(true);
  });

  it("andThen is flatMap", () => {
    expectType<TypeEqual<typeof andThen, typeof flatMap>>(true);
  });

  it("fromNullable strips null and undefined", () => {
    const m = fromNullable("x" as string | null);
    type Out = typeof m;
    expectType<TypeEqual<Out, Maybe<string>>>(true);
  });

  it("match preserves handler return type", () => {
    const out = match(
      some(1),
      (v) => v + 1,
      () => 0,
    );
    expectType<TypeEqual<typeof out, number>>(true);
  });

  it("unwrapOr returns default type on None", () => {
    const v = unwrapOr(none<number>(), 0);
    expectType<TypeEqual<typeof v, number>>(true);
  });
});

describe("Maybe tap types", () => {
  it("tap data-first preserves the Maybe type", () => {
    const m = tap(some(1), (n) => void n);
    expectType<TypeEqual<typeof m, Maybe<number>>>(true);
  });

  it("tap curried returns a Maybe-to-Maybe endomorphism", () => {
    const run = tap<number>((n) => void n);
    expectType<TypeEqual<typeof run, (maybe: Maybe<number>) => Maybe<number>>>(true);
  });
});
