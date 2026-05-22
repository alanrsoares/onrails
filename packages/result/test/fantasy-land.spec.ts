import { describe, expect, it } from "bun:test";
import { err, flatMap, map, of, ok } from "../src/result.js";

/** Functor: map(of(a), f) === of(f(a)) */
describe("Fantasy Land laws (sync)", () => {
  it("functor identity", () => {
    const a = ok(42);
    expect(map((x: number) => x)(a)).toEqual(a);
  });

  it("functor composition", () => {
    const a = ok(2);
    const f = (x: number) => x + 1;
    const g = (x: number) => x * 2;
    expect(map(g)(map(f)(a))).toEqual(map((x) => g(f(x)))(a));
  });

  it("monad left identity", () => {
    const f = (x: number) => ok(x * 2);
    expect(flatMap(f)(of(10))).toEqual(f(10));
  });

  it("monad right identity", () => {
    const m = ok(10);
    expect(flatMap(of)(m)).toEqual(m);
  });

  it("monad associativity", () => {
    const m = ok(5);
    const f = (x: number) => ok(x + 1);
    const g = (x: number) => ok(x * 2);
    expect(flatMap(g)(flatMap(f)(m))).toEqual(flatMap(g)(flatMap(f)(m)));
  });

  it("Err is left zero", () => {
    const f = (x: number) => ok(x);
    expect(flatMap(f)(err("e"))).toEqual(err("e"));
  });
});
