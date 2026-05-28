import { describe, expect, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { flow } from "../src/pipe.js";
import { flatMap, map, ok, pipe, tap } from "../src/result.js";
import type { Result } from "../src/types.js";

describe("pipe", () => {
  it("returns the value untouched with no fns", () => {
    expect(pipe(42)).toBe(42);
  });

  it("threads through a single fn", () => {
    expect(pipe(2, (n: number) => n * 3)).toBe(6);
  });

  it("composes left-to-right across many steps", () => {
    const out = pipe(
      ok(2) as Result<number, "parse">,
      map((n: number) => n + 1),
      flatMap((n) => ok(`v=${n}`)),
      tap((s: string) => {
        // observe only
        void s;
      }),
    );
    expect(out).toEqual(ok("v=3"));
  });

  it("preserves railway types end-to-end", () => {
    const out = pipe(
      ok(1) as Result<number, "parse">,
      map((n: number) => n * 2),
      flatMap((n) => (n > 0 ? ok(String(n)) : ok("neg"))),
    );
    expectType<TypeEqual<typeof out, Result<string, "parse">>>(true);
  });
});

describe("flow", () => {
  it("composes unary fns into a reusable pipeline", () => {
    const f = flow(
      (s: string) => s.trim(),
      (s: string) => s.toUpperCase(),
      (s: string) => `[${s}]`,
    );
    expect(f("  hi  ")).toBe("[HI]");
  });

  it("preserves multi-arg input on the first fn", () => {
    const add = (a: number, b: number) => a + b;
    const f = flow(add, (n: number) => `sum=${n}`);
    expect(f(2, 3)).toBe("sum=5");
  });

  it("threads Result through railway helpers", () => {
    const parseAndDouble = flow(
      (raw: string): Result<number, "nan"> => {
        const n = Number(raw);
        return Number.isFinite(n) ? ok(n) : ok(0); // narrow for test
      },
      map((n: number) => n * 2),
    );
    expect(parseAndDouble("3")).toEqual(ok(6));
  });
});
