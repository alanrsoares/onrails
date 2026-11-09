import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { ResultAsync } from "../src/async.js";
import { pipe } from "../src/pipe.js";
import { err, ok, type Result } from "../src/result.js";
import { foldSeq, traverseSeq } from "../src/sequence.js";

const step = (n: number): Result<number, string> => (n % 3 === 0 ? err(`bad:${n}`) : ok(n * 10));

async function* asyncGen<T>(items: readonly T[]): AsyncGenerator<T> {
  for (const item of items) yield item;
}

/** Records when each step starts and settles, to prove one-at-a-time order. */
const tracer = () => {
  const log: string[] = [];
  const run = (n: number): ResultAsync<number, string> =>
    ResultAsync.defer(async () => {
      log.push(`start:${n}`);
      await new Promise((r) => setTimeout(r, 1));
      log.push(`end:${n}`);
      return step(n);
    });
  return { log, run };
};

describe("traverseSeq", () => {
  it("partitions items into ok values and failures, in input order", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 50 })), async (ns) => {
        const out = await traverseSeq(ns, step).resolve();
        expect(out).toEqual(
          ok({
            ok: ns.filter((n) => n % 3 !== 0).map((n) => n * 10),
            failed: ns.filter((n) => n % 3 === 0).map((n) => ({ item: n, error: `bad:${n}` })),
          }),
        );
      }),
    );
  });

  it("starts each step after the one before it has settled", async () => {
    const { log, run } = tracer();
    await traverseSeq([1, 2, 3], run).resolve();
    expect(log).toEqual(["start:1", "end:1", "start:2", "end:2", "start:3", "end:3"]);
  });

  it("starts at the call, not on resolve", () => {
    let calls = 0;
    traverseSeq([1], (n) => {
      calls += 1;
      return ok(n);
    });
    expect(calls).toBe(1);
  });

  it.each([
    { label: "array", source: () => [1, 3] },
    { label: "Set", source: () => new Set([1, 3]) },
    { label: "async generator", source: () => asyncGen([1, 3]) },
  ])("reads a $label", async ({ source }) => {
    expect(await traverseSeq(source(), step).resolve()).toEqual(
      ok({ ok: [10], failed: [{ item: 3, error: "bad:3" }] }),
    );
  });

  it("does not unwrap items that are themselves thenables", async () => {
    const items = [ResultAsync.ok<number, string>(1)];
    const out = await traverseSeq(items, (ra) => ok(ra instanceof ResultAsync)).resolve();
    expect(out).toEqual(ok({ ok: [true], failed: [] }));
  });

  it("curried form works in pipe", async () => {
    expect(await pipe([2, 3], traverseSeq(step)).resolve()).toEqual(
      ok({ ok: [20], failed: [{ item: 3, error: "bad:3" }] }),
    );
  });
});

describe("foldSeq", () => {
  const add = (sum: number, n: number): Result<number, string> =>
    n % 3 === 0 ? err(`bad:${n}`) : ok(sum + n);

  it("a failed step leaves the state unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 50 })), async (ns) => {
        const out = await foldSeq(ns, 0, add).resolve();
        expect(out).toEqual(
          ok({
            state: ns.filter((n) => n % 3 !== 0).reduce((a, b) => a + b, 0),
            failed: ns.filter((n) => n % 3 === 0).map((n) => ({ item: n, error: `bad:${n}` })),
          }),
        );
      }),
    );
  });

  it("each step reads the state the step before it produced", async () => {
    const seen: (string | null)[] = [];
    const out = await foldSeq(["a", "b", "c"], null as string | null, (after, id) => {
      seen.push(after);
      return ResultAsync.ok<string, never>(id);
    }).resolve();
    expect(seen).toEqual([null, "a", "b"]);
    expect(out).toEqual(ok({ state: "c", failed: [] }));
  });

  it("starts each step after the one before it has settled", async () => {
    const { log, run } = tracer();
    await foldSeq([1, 2], 0, (_s, n) => run(n)).resolve();
    expect(log).toEqual(["start:1", "end:1", "start:2", "end:2"]);
  });

  it("curried form works in pipe", async () => {
    expect(await pipe(asyncGen([1, 2, 3]), foldSeq(0, add)).resolve()).toEqual(
      ok({ state: 3, failed: [{ item: 3, error: "bad:3" }] }),
    );
  });
});

describe("defects", () => {
  it("a throwing step rejects resolve()", async () => {
    const out = traverseSeq([1], (): Result<number, string> => {
      throw new Error("defect");
    });
    await expect(out.resolve()).rejects.toThrow("defect");
  });
});
