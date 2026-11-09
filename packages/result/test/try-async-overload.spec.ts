import { describe, expect, it } from "bun:test";
import { tryAsync } from "../src/async-lift.js";
import { err, ok } from "../src/result.js";

describe("tryAsync function overload", () => {
  it("resolves a function's promise", async () => {
    expect(await tryAsync(() => Promise.resolve(42)).resolve()).toEqual(ok(42));
  });

  const failures = [
    {
      label: "synchronous throw",
      run: (): Promise<never> => {
        throw "failure";
      },
    },
    { label: "promise rejection", run: () => Promise.reject("failure") },
  ];

  it.each(failures)("normalizes $label", async ({ run }) => {
    expect(await tryAsync(run).resolve()).toEqual(err(new Error("failure")));
  });

  it.each(failures)("maps $label with the same mapper", async ({ run }) => {
    expect(await tryAsync(run, (cause) => ({ kind: "io", cause })).resolve()).toEqual(
      err({ kind: "io", cause: "failure" }),
    );
  });

  it("preserves the original Error", async () => {
    const error = new Error("failure");
    const result = await tryAsync(() => {
      throw error;
    }).resolve();
    expect(result._tag === "Err" && result.error).toBe(error);
  });
});

describe("tryAsync function evaluation", () => {
  it("defers the function and runs it only once across resolutions", async () => {
    let calls = 0;
    const result = tryAsync(() => {
      calls += 1;
      return Promise.resolve(calls);
    });
    expect(calls).toBe(0);
    expect(await Promise.all([result.resolve(), result.resolve()])).toEqual([ok(1), ok(1)]);
    expect(calls).toBe(1);
  });

  it("accepts a non-Promise thenable without mapping success", async () => {
    const promise = Promise.resolve(42);
    // biome-ignore lint/suspicious/noThenProperty: exercise the PromiseLike overload with a non-Promise thenable.
    const thenable = { then: promise.then.bind(promise) };
    let mapped = false;
    const result = tryAsync(
      () => thenable,
      () => {
        mapped = true;
        return "failure";
      },
    );
    expect(await result.resolve()).toEqual(ok(42));
    expect(mapped).toBe(false);
  });
});
