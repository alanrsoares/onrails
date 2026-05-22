import { describe, expect, it } from "bun:test";
import { errAsync, fromPromise, fromSafePromise, okAsync, ResultAsync } from "../src/async.js";
import { err, ok } from "../src/result.js";

describe("ResultAsync", () => {
  it("fromPromise maps rejection", async () => {
    const ra = fromPromise(Promise.reject(new Error("boom")), (e) =>
      e instanceof Error ? e.message : String(e),
    );
    expect(await ra.resolve()).toEqual(err("boom"));
  });

  it("fromSafePromise never rejects", async () => {
    expect(await fromSafePromise(Promise.resolve(42)).resolve()).toEqual(ok(42));
  });

  it("await ra resolves to bare tagged-union Result (thenable)", async () => {
    const r = await okAsync<number, Error>(7);
    expect(r).toEqual(ok(7));

    const r2 = await errAsync<number, string>("nope");
    expect(r2).toEqual(err("nope"));
  });

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

  it("match returns a plain value", async () => {
    const value = await okAsync("x").match(
      (v) => v.toUpperCase(),
      () => "fail",
    );
    expect(value).toBe("X");
  });
});
