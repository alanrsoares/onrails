import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CompatResult,
  err,
  fromPromise,
  ok,
  Result,
  ResultAsync,
} from "../src/compat/neverthrow.js";

/** Patterns lifted from printr-mcp (state.ts, client.ts, parse flows) */

describe("neverthrow compat — sync", () => {
  const toStateError = (e: unknown): { message: string } => ({
    message: e instanceof Error ? e.message : String(e),
  });

  const safeReadFile = CompatResult.fromThrowable(
    (path: string) => readFileSync(path, "utf-8"),
    toStateError,
  );

  const safeParseJson = CompatResult.fromThrowable(
    (raw: string) => JSON.parse(raw) as { version: number },
    toStateError,
  );

  it("fromThrowable + andThen + unwrapOr (state load pattern)", () => {
    const defaultState = { version: 1 };
    const loaded = safeReadFile(__filename)
      .andThen((raw) => safeParseJson(raw))
      .unwrapOr(defaultState);
    expect(loaded.version).toBe(1);
  });

  it("combine tuple preserves order", () => {
    const combined = Result.combine([ok(1), ok("x")] as const);
    expect(combined.isOk()).toBe(true);
    combined.match(
      ([a, b]) => {
        expect(a).toBe(1);
        expect(b).toBe("x");
      },
      () => {
        throw new Error("expected Ok");
      },
    );
  });

  it("err short-circuits andThen", () => {
    const r = ok(1).andThen(() => err("fail"));
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toBe("fail");
  });
});

describe("neverthrow compat — async", () => {
  it("fromPromise + andThen", async () => {
    const ra = ResultAsync.fromPromise(Promise.resolve(10), (e) => String(e)).andThen((n) =>
      ResultAsync.fromSafePromise(Promise.resolve(n + 5)),
    );
    expect(
      await ra.match(
        (v) => v,
        () => -1,
      ),
    ).toBe(15);
  });

  it("fromPromise maps rejection", async () => {
    const ra = fromPromise(Promise.reject(new Error("net")), (e) =>
      e instanceof Error ? e.message : "unknown",
    );
    expect(
      await ra.match(
        () => "ok",
        (msg) => msg,
      ),
    ).toBe("net");
  });
});

describe("neverthrow compat — tees", () => {
  it("andTee runs side effect without changing value", async () => {
    const seen: number[] = [];
    const ra = ResultAsync.fromSafePromise(Promise.resolve(3)).andTee((n) => {
      seen.push(n);
    });
    const r = await ra;
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toBe(3);
    expect(seen).toEqual([3]);
  });

  it("andTee ignores a throwing tee and keeps the Ok", async () => {
    const ra = ResultAsync.fromSafePromise(Promise.resolve(3)).andTee(() => {
      throw new Error("tee boom");
    });
    const r = await ra;
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toBe(3);
  });

  it("orTee runs side effect and preserves the original Err", async () => {
    const seen: string[] = [];
    const ra = ResultAsync.err<number, string>("boom").orTee((e) => {
      seen.push(e);
    });
    const r = await ra;
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toBe("boom");
    expect(seen).toEqual(["boom"]);
  });

  it("orTee ignores a rejecting tee and keeps the original Err", async () => {
    const ra = ResultAsync.err<number, string>("boom").orTee(() =>
      Promise.reject(new Error("tee boom")),
    );
    const r = await ra;
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toBe("boom");
  });
});
