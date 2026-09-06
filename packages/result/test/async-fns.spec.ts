import { describe, expect, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import type { ResultAsync } from "../src/async.js";
import * as RA from "../src/async-fns.js";
import { errAsync, okAsync } from "../src/async-lift.js";
import { flow, pipe } from "../src/pipe.js";
import { err, ok } from "../src/result.js";

type User = { id: string; name: string };
const loadUser = (id: string) =>
  id === "u1"
    ? okAsync<User, "notFound">({ id, name: "Ada" })
    : errAsync<User, "notFound">("notFound");
const loadOrders = (user: User) =>
  user.id === "u1" ? okAsync<number[], "dbErr">([1, 2, 3]) : errAsync<number[], "dbErr">("dbErr");

const cases: Array<{ label: string; run: () => Promise<unknown[]> }> = [
  {
    label: "map",
    run: async () => [
      await RA.map(okAsync(2), (n) => n * 3).resolve(),
      await RA.map((n: number) => n * 3)(okAsync(2)).resolve(),
    ],
  },
  {
    label: "mapErr",
    run: async () => [
      await RA.mapErr(errAsync<number, string>("e"), (e) => e.length).resolve(),
      await RA.mapErr((e: string) => e.length)(errAsync<number, string>("e")).resolve(),
    ],
  },
  {
    label: "bimap",
    run: async () => [
      await RA.bimap(
        okAsync<number, string>(2),
        (n) => n + 1,
        (e) => e.length,
      ).resolve(),
      await RA.bimap(
        (n: number) => n + 1,
        (e: string) => e.length,
      )(okAsync<number, string>(2)).resolve(),
    ],
  },
  {
    label: "flatMap",
    run: async () => [
      await RA.flatMap(okAsync(2), (n) => okAsync(n * 5)).resolve(),
      await RA.flatMap((n: number) => okAsync(n * 5))(okAsync(2)).resolve(),
    ],
  },
  {
    label: "recover",
    run: async () => [
      await RA.recover(errAsync<number, string>("e"), () => okAsync(0)).resolve(),
      await RA.recover((_e: string) => okAsync<number, never>(0))(
        errAsync<number, string>("e"),
      ).resolve(),
    ],
  },
  {
    label: "match",
    run: async () => [
      await RA.match(
        okAsync<number, string>(2),
        (n) => `ok:${n}`,
        (e) => `err:${e}`,
      ),
      await RA.match(
        (n: number) => `ok:${n}`,
        (e: string) => `err:${e}`,
      )(okAsync<number, string>(2)),
    ],
  },
  {
    label: "unwrapOr",
    run: async () => [
      await RA.unwrapOr(errAsync<number, string>("e"), 0),
      await RA.unwrapOr(0)(errAsync<number, string>("e")),
    ],
  },
];

describe("async data-last: both call forms agree", () => {
  it.each(cases.map((c) => [c.label, c] as const))("%s", async (_label, c) => {
    const [dataFirst, curried] = await c.run();
    expect(dataFirst).toEqual(curried);
  });
});

describe("async data-last: tap helpers observe their own track", () => {
  it("tap fires only on Ok, tapErr only on Err", async () => {
    const seen: string[] = [];

    expect(
      await pipe(
        okAsync<number, string>(1),
        RA.tap((n) => seen.push(`ok:${n}`)),
        RA.tapErr((e) => seen.push(`err:${e}`)),
      ).resolve(),
    ).toEqual(ok(1));

    expect(
      await pipe(
        errAsync<number, string>("bad"),
        RA.tap((n) => seen.push(`ok:${n}`)),
        RA.tapErr((e) => seen.push(`err:${e}`)),
      ).resolve(),
    ).toEqual(err("bad"));

    expect(seen).toEqual(["ok:1", "err:bad"]);
  });
});

describe("async data-last: composes with pipe and flow", () => {
  it("pipe threads an async railway", async () => {
    const out = pipe(
      loadUser("u1"),
      RA.flatMap(loadOrders),
      RA.map((orders) => orders.length),
    );
    expect(await out.resolve()).toEqual(ok(3));
  });

  it("flow builds a reusable async pipeline", async () => {
    const orderCount = flow(
      loadUser,
      RA.flatMap(loadOrders),
      RA.map((orders) => orders.length),
    );
    expect(await orderCount("u1").resolve()).toEqual(ok(3));
    expect(await orderCount("nope").resolve()).toEqual(err("notFound"));
  });

  it("short-circuits at the first Err without running later steps", async () => {
    let ran = 0;
    const out = pipe(
      errAsync<User, "notFound">("notFound"),
      RA.flatMap((user) => {
        ran += 1;
        return loadOrders(user);
      }),
    );
    expect(await out.resolve()).toEqual(err("notFound"));
    expect(ran).toBe(0);
  });

  it("flatMap accepts a sync Result step", async () => {
    const out = pipe(
      okAsync<number, "a">(2),
      RA.flatMap((n) => (n > 1 ? ok(n) : err("tooSmall" as const))),
    );
    expect(await out.resolve()).toEqual(ok(2));
  });
});

describe("async data-last types", () => {
  it("infers lambda params inside pipe and accumulates errors", () => {
    const out = pipe(
      loadUser("u1"),
      RA.flatMap(loadOrders),
      RA.map((orders) => orders.length),
    );
    expectType<TypeEqual<typeof out, ResultAsync<number, "notFound" | "dbErr">>>(true);
  });

  it("flow builds a reusable async pipeline", () => {
    const orderCount = flow(
      loadUser,
      RA.flatMap(loadOrders),
      RA.map((orders) => orders.length),
    );
    expectType<TypeEqual<ReturnType<typeof orderCount>, ResultAsync<number, "notFound" | "dbErr">>>(
      true,
    );
  });

  it("mapErr and recover rewrite only the error channel", () => {
    const mapped = pipe(
      loadUser("u1"),
      RA.mapErr((e) => ({ kind: e })),
    );
    expectType<TypeEqual<typeof mapped, ResultAsync<User, { kind: "notFound" }>>>(true);

    const recovered = pipe(
      loadUser("u1"),
      RA.recover(() => errAsync<User, "fallback">("fallback")),
    );
    expectType<TypeEqual<typeof recovered, ResultAsync<User, "fallback">>>(true);
  });

  it("terminals collapse to a plain Promise", () => {
    const folded = pipe(
      loadUser("u1"),
      RA.match(
        (u) => u.name,
        (e) => e.length,
      ),
    );
    expectType<TypeEqual<typeof folded, Promise<string | number>>>(true);

    const defaulted = pipe(loadUser("u1"), RA.unwrapOr(null));
    expectType<TypeEqual<typeof defaulted, Promise<User | null>>>(true);
  });

  it("data-first form matches the curried form", () => {
    const dataFirst = RA.map(loadUser("u1"), (u) => u.name);
    const curried = RA.map((u: User) => u.name)(loadUser("u1"));
    expectType<TypeEqual<typeof dataFirst, ResultAsync<string, "notFound">>>(true);
    expectType<TypeEqual<typeof curried, ResultAsync<string, "notFound">>>(true);
  });
});
