import { describe, expect, it } from "bun:test";
import type { Result } from "@onrails/result";
import { err, ok } from "@onrails/result";
import { expectType, type TypeEqual } from "ts-expect";
import { matchTag } from "../src/tag.js";

// Structural twin of `Maybe<T>` from @onrails/maybe: pattern does not depend on that package.
type MaybeShape<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };

const some = <T>(value: T): MaybeShape<T> => ({ _tag: "Some", value });
const none: MaybeShape<number> = { _tag: "None" };

describe("matchTag type behaviour", () => {
  it.each([
    { label: "Ok", input: ok(1) as Result<number, string>, expected: "ok:1" },
    { label: "Err", input: err("x") as Result<number, string>, expected: "err:x" },
  ])("Result $label branch runs and narrows", ({ input, expected }) => {
    const out = matchTag(input, {
      Ok: (v) => {
        expectType<TypeEqual<typeof v.value, number>>(true);
        return `ok:${v.value}`;
      },
      Err: (e) => {
        expectType<TypeEqual<typeof e.error, string>>(true);
        return `err:${e.error}`;
      },
    });
    expectType<TypeEqual<typeof out, string>>(true);
    expect(out).toBe(expected);
  });

  it.each([
    { label: "Some", input: some(2), expected: 4 },
    { label: "None", input: none, expected: 0 },
  ])("Maybe-shaped $label branch runs and narrows", ({ input, expected }) => {
    const out = matchTag(input, {
      Some: (s) => {
        expectType<TypeEqual<typeof s.value, number>>(true);
        return s.value * 2;
      },
      None: (n) => {
        expectType<TypeEqual<typeof n, { readonly _tag: "None" }>>(true);
        return 0;
      },
    });
    expectType<TypeEqual<typeof out, number>>(true);
    expect(out).toBe(expected);
  });

  it("handler return type is inferred from the handlers", () => {
    const out = matchTag(ok(1) as Result<number, string>, {
      Ok: (v) => v.value,
      Err: () => null,
    });
    expectType<TypeEqual<typeof out, number | null>>(true);
  });

  it("rejects a missing handler and an unknown tag", () => {
    // type-level only: never invoked
    const _typeOnly = (r: Result<number, string>): void => {
      // @ts-expect-error Err handler is required for exhaustiveness
      matchTag(r, { Ok: () => 0 });
      // @ts-expect-error "Maybe" is not a _tag of Result
      matchTag(r, { Ok: () => 0, Err: () => 0, Maybe: () => 0 });
    };
    expect(_typeOnly).toBeDefined();
  });
});
