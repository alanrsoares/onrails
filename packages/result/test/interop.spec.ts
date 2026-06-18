import { describe, expect, it } from "bun:test";
import { asyncAfter, fromAsync, fromResult, type InferErr, type InferOk } from "../src/interop.js";
import { err, ok } from "../src/result.js";
import type { Result } from "../src/types.js";

describe("fromAsync", () => {
  const returnsPromisedResult = async (s: string) => {
    switch (s.length) {
      case 0:
        return ok("ok" as const);
      case 1:
        return err(1 as const);
      case 2:
        return ok(2 as const);
    }
    return err("err" as const);
  };

  it("lifts Promise<Result> to ResultAsync with union inference", async () => {
    type R = Awaited<ReturnType<typeof returnsPromisedResult>>;
    type T = InferOk<R>;
    type E = InferErr<R>;
    const _t: T = "ok";
    const _e: E = 1;
    void _t;
    void _e;

    const ra = fromAsync(returnsPromisedResult)("");
    expect(
      await ra.match(
        (v) => v,
        () => "fail",
      ),
    ).toBe("ok");
  });

  it("maps promise rejection to UnexpectedError", async () => {
    const ra = fromAsync(async (): Promise<Result<never, never>> => {
      throw new Error("boom");
    })();
    const result = await ra.resolve();
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error.name).toBe("UnexpectedError");
    }
  });
});

describe("fromResult", () => {
  it("lifts Ok into ResultAsync without changing the value", async () => {
    expect(await fromResult(ok(1)).resolve()).toEqual(ok(1));
  });

  it("lifts Err into ResultAsync without wrapping the error", async () => {
    const error = new Error("domain");
    expect(await fromResult(err(error)).resolve()).toEqual(err(error));
  });
});

describe("asyncAfter", () => {
  it("runs the async step on Ok", async () => {
    const result = await asyncAfter(ok(1), (n) => fromResult(ok(n + 1))).resolve();
    expect(result).toEqual(ok(2));
  });

  it("short-circuits on Err without calling the async step", async () => {
    let called = false;
    const result = await asyncAfter(err("stop"), () => {
      called = true;
      return fromResult(ok(1));
    }).resolve();
    expect(result).toEqual(err("stop"));
    expect(called).toBe(false);
  });

  it("propagates async step errors", async () => {
    const result = await asyncAfter(ok(1), () => fromResult(err("async"))).resolve();
    expect(result).toEqual(err("async"));
  });

  describe("data-last (curried)", () => {
    it("runs the async step on Ok", async () => {
      const bind = asyncAfter((n: number) => fromResult(ok(n + 1)));
      expect(await bind(ok(1)).resolve()).toEqual(ok(2));
    });

    it("short-circuits on Err without calling the async step", async () => {
      let called = false;
      const bind = asyncAfter((n: number) => {
        called = true;
        return fromResult(ok(n));
      });
      expect(await bind(err("stop")).resolve()).toEqual(err("stop"));
      expect(called).toBe(false);
    });

    it("unions upstream and async-step errors", async () => {
      const bind = asyncAfter((n: number) => fromResult(n > 0 ? ok(n) : err("neg" as const)));
      const upstream: Result<number, "bad"> = err("bad");
      expect(await bind(upstream).resolve()).toEqual(err("bad"));
    });
  });
});
