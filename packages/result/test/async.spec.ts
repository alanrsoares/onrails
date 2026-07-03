import { describe, expect, it } from "bun:test";
import { ResultAsync } from "../src/async.js";
import { errAsync, fromPromise, fromSafePromise, okAsync, tryAsync } from "../src/async-lift.js";
import { err, ok } from "../src/result.js";

describe("ResultAsync: construction", () => {
  it("fromPromise maps rejection", async () => {
    const ra = fromPromise(Promise.reject(new Error("boom")), (e) =>
      e instanceof Error ? e.message : String(e),
    );
    expect(await ra.resolve()).toEqual(err("boom"));
  });

  it("fromSafePromise never rejects", async () => {
    expect(await fromSafePromise(Promise.resolve(42)).resolve()).toEqual(ok(42));
  });

  it("tryAsync normalizes rejection to Error by default", async () => {
    const result = await tryAsync(Promise.reject("boom")).resolve();
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("boom");
    }
  });

  it("tryAsync honors custom rejection mapping", async () => {
    const result = await tryAsync(Promise.reject(new Error("boom")), (e) =>
      e instanceof Error ? e.message : "unknown",
    ).resolve();
    expect(result).toEqual(err("boom"));
  });

  it("fromResultPromise passes a Result-shaped Ok value through verbatim", async () => {
    const inner = ok(1);
    const result = await ResultAsync.fromResultPromise(Promise.resolve(ok(inner))).resolve();
    expect(result).toEqual(ok(inner));
  });

  it("await ra resolves to bare tagged-union Result (thenable)", async () => {
    const r = await okAsync<number, Error>(7);
    expect(r).toEqual(ok(7));

    const r2 = await errAsync<number, string>("nope");
    expect(r2).toEqual(err("nope"));
  });
});

describe("ResultAsync: chaining and combine", () => {
  it("flatMap chains async steps", async () => {
    const ra = okAsync(2).flatMap((n) => okAsync(n + 1));
    expect(await ra.resolve()).toEqual(ok(3));
  });

  it("stops on Err in chain", async () => {
    const ra = okAsync(1).flatMap(() => errAsync("stop"));
    expect(await ra.resolve()).toEqual(err("stop"));
  });

  it("flatMap accepts a sync Result", async () => {
    const ra = okAsync(2).flatMap((n) => ok(n * 10));
    expect(await ra.resolve()).toEqual(ok(20));
  });

  it("flatMap no longer admits compat-shaped { inner } returns", () => {
    // @ts-expect-error core flatMap accepts only Result | ResultAsync; compat coerces at its own boundary
    void okAsync(1).flatMap((n) => ({ inner: ok(n) }));
  });

  it("combine aggregates async results", async () => {
    const combined = ResultAsync.combine([okAsync(1), okAsync(2)]);
    expect(await combined.resolve()).toEqual(ok([1, 2]));
  });

  it("combineTuple preserves value order at runtime", async () => {
    const combined = ResultAsync.combineTuple([okAsync(1), okAsync("a")] as const);
    expect(await combined.resolve()).toEqual(ok([1, "a"]));
  });

  it("combineTuple returns first Err in input order", async () => {
    const combined = ResultAsync.combineTuple([
      okAsync(1),
      errAsync("first"),
      errAsync("second"),
    ] as const);
    expect(await combined.resolve()).toEqual(err("first"));
  });
});

describe("ResultAsync: tuple concurrency", () => {
  it("combineTupleParallel returns first Err in input order", async () => {
    const combined = ResultAsync.combineTupleParallel([
      okAsync(1),
      errAsync("first"),
      errAsync("second"),
    ] as const);
    expect(await combined.resolve()).toEqual(err("first"));
  });

  it("combineTupleParallel overlaps lazy branch work", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const lazy = (value: number) =>
      ResultAsync.defer(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return ok(value);
      });

    const result = await ResultAsync.combineTupleParallel([lazy(1), lazy(2)] as const).resolve();
    expect(result).toEqual(ok([1, 2]));
    expect(maxInFlight).toBe(2);
  });

  it("combineTuple runs lazy branches one at a time", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const lazy = (value: number) =>
      ResultAsync.defer(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return ok(value);
      });

    const result = await ResultAsync.combineTuple([lazy(1), lazy(2)] as const).resolve();
    expect(result).toEqual(ok([1, 2]));
    expect(maxInFlight).toBe(1);
  });
});

describe("ResultAsync: terminal and recovery", () => {
  it("match returns a plain value", async () => {
    const value = await okAsync("x").match(
      (v) => v.toUpperCase(),
      () => "fail",
    );
    expect(value).toBe("X");
  });

  it("recover can return failed async values to the success track", async () => {
    expect(
      await errAsync<number, string>("missing")
        .recover(() => okAsync(0))
        .resolve(),
    ).toEqual(ok(0));
    expect(
      await errAsync<number, string>("bad")
        .orElse((error) => err(error.length))
        .resolve(),
    ).toEqual(err(3));
    expect(
      await okAsync<number, string>(1)
        .recover(() => err("never"))
        .resolve(),
    ).toEqual(ok(1));
  });

  it("tap helpers observe only their matching async track", async () => {
    const seen: string[] = [];

    expect(
      await okAsync<number, string>(1)
        .tap((value) => seen.push(`ok:${value}`))
        .resolve(),
    ).toEqual(ok(1));
    expect(
      await errAsync<number, string>("bad")
        .tapErr((error) => seen.push(`err:${error}`))
        .resolve(),
    ).toEqual(err("bad"));
    expect(seen).toEqual(["ok:1", "err:bad"]);
  });
});

describe("ResultAsync: memoization / single execution", () => {
  it("memoizes resolution and runs factory at most once", async () => {
    let callCount = 0;
    const ra = ResultAsync.defer(async () => {
      callCount += 1;
      return ok(callCount);
    });

    const res1 = await ra.resolve();
    const res2 = await ra.resolve();
    const res3 = await ra;

    expect(res1).toEqual(ok(1));
    expect(res2).toEqual(ok(1));
    expect(res3).toEqual(ok(1));
    expect(callCount).toBe(1);
  });

  it("memoizes mapping operations so mapped results also evaluate parent once", async () => {
    let callCount = 0;
    const parent = ResultAsync.defer(async () => {
      callCount += 1;
      return ok(callCount);
    });

    const child = parent.map((n) => n * 2);

    const res1 = await child.resolve();
    const res2 = await child.resolve();

    expect(res1).toEqual(ok(2));
    expect(res2).toEqual(ok(2));
    expect(callCount).toBe(1);
  });
});
