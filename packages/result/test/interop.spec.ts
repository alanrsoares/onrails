import { describe, expect, it } from "bun:test";
import { fromAsync, type InferErr, type InferOk, makeResultAsync } from "../src/interop.js";
import { err, ok } from "../src/result.js";

describe("fromAsync", () => {
  const returnsPromisedResult = async (s: string) => {
    if (s.length === 0) {
      return ok("ok" as const);
    }
    if (s.length === 1) {
      return err(1 as const);
    }
    if (s.length === 2) {
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
    const ra = fromAsync(async () => {
      throw new Error("boom");
    })();
    const result = await ra.resolve();
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error.name).toBe("UnexpectedError");
    }
  });

  it("makeResultAsync works for nullary factories", async () => {
    const ra = makeResultAsync(() => returnsPromisedResult("ab"));
    expect(
      await ra.match(
        (v) => v,
        () => -1,
      ),
    ).toBe(2);
  });
});
