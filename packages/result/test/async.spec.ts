import { describe, expect, it } from "bun:test";
import {
  errAsync,
  fromPromise,
  fromSafePromise,
  okAsync,
  parallelTupleAsync,
  ResultAsync,
  sequenceTupleAsync,
  tryAsync,
} from "../src/async.js";
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

  it("combine aggregates async results", async () => {
    const combined = ResultAsync.combine([okAsync(1), okAsync(2)]);
    expect(await combined.resolve()).toEqual(ok([1, 2]));
  });

  it("sequenceTupleAsync preserves value order at runtime", async () => {
    const combined = sequenceTupleAsync([okAsync(1), okAsync("a")] as const);
    expect(await combined.resolve()).toEqual(ok([1, "a"]));
  });

  it("sequenceTupleAsync aliases sequential tuple combine", async () => {
    const combined = sequenceTupleAsync([okAsync(1), okAsync("a")] as const);
    expect(await combined.resolve()).toEqual(ok([1, "a"]));
  });

  it("sequenceTupleAsync returns first Err in input order", async () => {
    const combined = sequenceTupleAsync([
      okAsync(1),
      errAsync("first"),
      errAsync("second"),
    ] as const);
    expect(await combined.resolve()).toEqual(err("first"));
  });
});

describe("ResultAsync: tuple concurrency", () => {
  it("parallelTupleAsync returns first Err in input order", async () => {
    const combined = parallelTupleAsync([
      okAsync(1),
      errAsync("first"),
      errAsync("second"),
    ] as const);
    expect(await combined.resolve()).toEqual(err("first"));
  });

  it("parallelTupleAsync aliases parallel tuple combine", async () => {
    const combined = parallelTupleAsync([
      okAsync(1),
      errAsync("first"),
      errAsync("second"),
    ] as const);
    expect(await combined.resolve()).toEqual(err("first"));
  });

  it("parallelTupleAsync overlaps lazy branch work", async () => {
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

    const result = await parallelTupleAsync([lazy(1), lazy(2)] as const).resolve();
    expect(result).toEqual(ok([1, 2]));
    expect(maxInFlight).toBe(2);
  });

  it("sequenceTupleAsync runs lazy branches one at a time", async () => {
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

    const result = await sequenceTupleAsync([lazy(1), lazy(2)] as const).resolve();
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
