import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { combineTupleAsync, ResultAsync, tryAsync } from "../src/async.js";
import type { ErrOf, OkOf, UnionErrors } from "../src/extra.js";
import { asyncAfter, fromAsync, fromResult, type InferErr, type InferOk } from "../src/interop.js";
import {
  deriveNamed,
  fromPromiseNamed,
  parallelNamed,
  parseWith,
  Railway,
  railway,
  requireNamed,
  select,
} from "../src/railway.js";
import {
  type andThen,
  bimap,
  type chain,
  combine,
  combineTuple,
  err,
  flatMap,
  flatMapResult,
  flatMapResultErr,
  isErr,
  isOk,
  map,
  mapErr,
  mapResult,
  match,
  type matchResult,
  matchWith,
  ok,
  trySync,
  unwrapErr,
  unwrapOk,
  unwrapOr,
} from "../src/result.js";
import { $, tryGen, yieldResult } from "../src/try-gen.js";
import type { Err, Ok, Result, UnexpectedError } from "../src/types.js";

describe("Result sync types", () => {
  it("ok and err preserve type params", () => {
    const success = ok(1);
    const failure = err("x");
    expectType<TypeEqual<typeof success, Result<number, never>>>(true);
    expectType<TypeEqual<typeof failure, Result<never, string>>>(true);
  });

  it("isOk and isErr narrow", () => {
    const r = ok(1) as Result<number, string>;
    if (isOk(r)) {
      expectType<TypeEqual<typeof r, Ok<number, string>>>(true);
      expectType<TypeEqual<typeof r.value, number>>(true);
    }
    if (isErr(r)) {
      expectType<TypeEqual<typeof r, Err<number, string>>>(true);
      expectType<TypeEqual<typeof r.error, string>>(true);
    }
  });

  it("mapResult and curried map change Ok type", () => {
    const r = mapResult(ok(1), (n) => String(n));
    expectType<TypeEqual<typeof r, Result<string, never>>>(true);
    const curried = map((n: number) => String(n))(ok(1));
    expectType<TypeEqual<typeof curried, Result<string, never>>>(true);
  });

  it("mapErr changes Err type", () => {
    const r = mapErr((e: number) => String(e))(err(1));
    expectType<TypeEqual<typeof r, Result<never, string>>>(true);
  });

  it("bimap maps both sides", () => {
    const r = bimap(
      ok(1),
      (n) => String(n),
      (e: never) => e,
    );
    expectType<TypeEqual<typeof r, Result<string, never>>>(true);
  });

  it("flatMap preserves error type", () => {
    const r = flatMap((n: number) => ok(String(n)))(ok(1));
    expectType<TypeEqual<typeof r, Result<string, never>>>(true);
  });

  it("flatMapResultErr unions errors", () => {
    const r = flatMapResultErr(ok(1), (n) =>
      n > 0 ? ok(String(n)) : err({ kind: "zero" as const }),
    );
    expectType<TypeEqual<typeof r, Result<string, { kind: "zero" }>>>(true);
  });

  it("flatMapResult is flatMap with same error", () => {
    const a = flatMapResult(ok(1), (n) => ok(String(n)));
    const b = flatMap((n: number) => ok(String(n)))(ok(1));
    expectType<TypeEqual<typeof a, typeof b>>(true);
  });

  it("andThen and chain are flatMap", () => {
    expectType<TypeEqual<typeof andThen, typeof flatMap>>(true);
    expectType<TypeEqual<typeof chain, typeof flatMap>>(true);
  });

  it("match preserves handler return type", () => {
    const out = match(
      ok(1),
      (v) => v + 1,
      () => 0,
    );
    expectType<TypeEqual<typeof out, number>>(true);
    const curried = matchWith(
      (v: number) => v + 1,
      () => 0,
    )(ok(1));
    expectType<TypeEqual<typeof curried, number>>(true);
  });

  it("matchResult is the same type as match", () => {
    expectType<TypeEqual<typeof matchResult, typeof match>>(true);
  });

  it("unwrapOr returns Ok type on success", () => {
    const v = unwrapOr(ok(1), 0);
    expectType<TypeEqual<typeof v, number>>(true);
  });

  it("unwrap helpers return the unwrapped side type", () => {
    const okValue = unwrapOk(ok(1) as Result<number, string>);
    const errValue = unwrapErr(err("x") as Result<number, string>);
    expectType<TypeEqual<typeof okValue, number>>(true);
    expectType<TypeEqual<typeof errValue, string>>(true);
  });

  it("combine collects values or first Err", () => {
    const r = combine([ok(1), ok(2)]);
    expectType<TypeEqual<typeof r, Result<number[], never>>>(true);
    const failed = combine([ok(1), err("x")]);
    expectType<TypeEqual<typeof failed, Result<number[], string>>>(true);
  });

  it("combineTuple preserves tuple shape", () => {
    // Bind to typed intermediates so contextual inference from the
    // `Result<unknown, unknown>` constraint doesn't widen `never` errors to `unknown`.
    const a = ok(1);
    const b = ok("a");
    const r = combineTuple([a, b] as const);
    expectType<TypeEqual<typeof r, Result<readonly [number, string], never>>>(true);
  });

  it("trySync preserves function arity and return", () => {
    const safe = trySync(
      (a: number, b: string) => a + b.length,
      (e) => String(e),
    );
    expectType<(a: number, b: string) => Result<number, string>>(safe);
  });
});

describe("ResultAsync types", () => {
  it("ok and err static factories", () => {
    const ra = ResultAsync.ok(1);
    const rb = ResultAsync.err("x");
    expectType<TypeEqual<typeof ra, ResultAsync<number, never>>>(true);
    expectType<TypeEqual<typeof rb, ResultAsync<never, string>>>(true);
  });

  it("fromPromise maps rejection", () => {
    const ra = ResultAsync.fromPromise(Promise.resolve(1), (e) => String(e));
    expectType<TypeEqual<typeof ra, ResultAsync<number, string>>>(true);
  });

  it("tryAsync defaults rejection type to Error", () => {
    const ra = tryAsync(Promise.resolve(1));
    const rb = tryAsync(Promise.resolve(1), (e) => String(e));
    expectType<TypeEqual<typeof ra, ResultAsync<number, Error>>>(true);
    expectType<TypeEqual<typeof rb, ResultAsync<number, string>>>(true);
  });

  it("combineTupleAsync preserves tuple shape and unions errors", () => {
    const a = ResultAsync.ok<number, "a">(1);
    const b = ResultAsync.ok<string, "b">("x");
    const combined = combineTupleAsync([a, b] as const);
    expectType<TypeEqual<typeof combined, ResultAsync<readonly [number, string], "a" | "b">>>(true);
  });

  it("flatMap unions errors from inner Result", () => {
    const ra = ResultAsync.ok(1).flatMap((n) =>
      n > 0 ? ok(String(n)) : err({ code: 1 as const }),
    );
    expectType<TypeEqual<typeof ra, ResultAsync<string, { code: 1 }>>>(true);
  });

  it("map changes success type", () => {
    const ra = ResultAsync.ok(1).map((n) => String(n));
    expectType<TypeEqual<typeof ra, ResultAsync<string, never>>>(true);
  });
});

describe("Result interop types", () => {
  const returnsResult = async (s: string): Promise<Result<string, number>> =>
    s.length > 0 ? ok(s) : err(1);

  it("InferOk and InferErr extract Promise<Result> types", () => {
    type R = Awaited<ReturnType<typeof returnsResult>>;
    expectType<TypeEqual<InferOk<R>, string>>(true);
    expectType<TypeEqual<InferErr<R>, number>>(true);
  });

  it("fromAsync lifts to ResultAsync with inferred params (errors widened with UnexpectedError)", () => {
    const lifted = fromAsync(returnsResult);
    expectType<(s: string) => ResultAsync<string, number | UnexpectedError>>(lifted);
  });

  it("fromResult lifts sync Result without UnexpectedError widening", () => {
    const lifted = fromResult(ok(1) as Result<number, "domain">);
    expectType<TypeEqual<typeof lifted, ResultAsync<number, "domain">>>(true);
  });

  it("asyncAfter unions sync and async errors", () => {
    const lifted = asyncAfter(ok(1) as Result<number, "sync">, (n) =>
      n > 0 ? ResultAsync.ok(String(n)) : ResultAsync.err("async" as const),
    );
    expectType<TypeEqual<typeof lifted, ResultAsync<string, "sync" | "async">>>(true);
  });
});

describe("Result extra types", () => {
  it("OkOf and ErrOf extract from Result", () => {
    type R = Result<number, { kind: "fail" }>;
    expectType<TypeEqual<OkOf<R>, number>>(true);
    expectType<TypeEqual<ErrOf<R>, { kind: "fail" }>>(true);
  });

  it("UnionErrors unions tuple errors", () => {
    type U = UnionErrors<[Result<number, "a">, Result<string, "b">]>;
    expectType<TypeEqual<U, "a" | "b">>(true);
  });
});

describe("Railway types", () => {
  it("sync-only workflows return Result", () => {
    const out = Railway.fromResult("id", () => ok("profile-1" as const))
      .derive("slug", ({ id }) => `${id}-slug`)
      .select(({ id, slug }) => ({ id, slug }));

    expectType<Result<{ id: "profile-1"; slug: string }, never>>(out);
  });

  it("promise steps upgrade output to ResultAsync", () => {
    const out = Railway.fromResult("id", () => ok("profile-1" as const))
      .fromPromise("row", ({ id }) => Promise.resolve({ id, name: "Ada" }), String)
      .select(({ row }) => row.name);

    expectType<ResultAsync<string, string>>(out);
  });

  it("require narrows nullable source under a new key", () => {
    const out = Railway.fromResult("row", () =>
      ok<{ id: string } | null, "missing">({ id: "profile-1" }),
    )
      .require("profile", "row", () => "missing" as const)
      .select(({ profile }) => profile.id);

    expectType<Result<string, "missing">>(out);
  });

  it("parallel adds branch output keys and upgrades to ResultAsync", () => {
    const out = Railway.fromResult("id", () => ok("profile-1" as const))
      .parallel({
        recent: ({ id }) => ResultAsync.ok([id]),
        metrics: () => ResultAsync.ok({ jobs: 2 }),
      })
      .select(({ recent, metrics }) => ({ recent, metrics }));

    expectType<ResultAsync<{ recent: "profile-1"[]; metrics: { jobs: number } }, never>>(out);
  });

  it("unions errors across workflow steps", () => {
    const out = Railway.fromResult("id", () => ok<string, "parse">("profile-1"))
      .fromResult("row", ({ id }) => ok<{ id: string }, "missing">({ id }))
      .fromAsync("saved", ({ row }) => ResultAsync.ok<{ id: string }, "write">(row))
      .select(({ saved }) => saved.id);

    expectType<ResultAsync<string, "parse" | "missing" | "write">>(out);
  });

  it("functional railway composes reusable steps", () => {
    const parseProfileId = parseWith(
      (input: string) => input.trim() as "profile-1",
      () => "parse" as const,
    ).as("profileId");

    const loadProfileRow = fromPromiseNamed(
      "row",
      ({ profileId }: { readonly profileId: "profile-1" }) =>
        Promise.resolve<{ id: "profile-1"; name: "Ada" } | null>({
          id: profileId,
          name: "Ada",
        }),
      () => "db" as const,
    );

    const requireProfile = requireNamed("profile", "row", () => "missing" as const);

    const normalize = deriveNamed(
      "normalized",
      ({ profile }: { readonly profile: { readonly id: "profile-1"; readonly name: string } }) =>
        profile.id,
    );

    const loadSummaryInputs = parallelNamed({
      recent: ({ normalized }: { readonly normalized: "profile-1" }) =>
        ResultAsync.ok([normalized]),
      metrics: () => ResultAsync.ok({ jobs: 2 }),
    });

    const out = railway(
      " profile-1 ",
      parseProfileId,
      loadProfileRow,
      requireProfile,
      normalize,
      loadSummaryInputs,
      select(({ normalized, recent, metrics }) => ({ normalized, recent, metrics })),
    );

    expectType<
      ResultAsync<
        { normalized: "profile-1"; recent: "profile-1"[]; metrics: { jobs: number } },
        "parse" | "db" | "missing"
      >
    >(out);
  });
});

describe("tryGen types", () => {
  it("$ aliases yieldResult without changing inference", () => {
    const withName = tryGen(() => {
      const value = yieldResult(ok(1));
      return ok(value + 1);
    });

    const withAlias = tryGen(() => {
      const value = $(ok(1));
      return ok(value + 1);
    });

    expectType<Result<number, never>>(withName);
    expectType<Result<number, never>>(withAlias);
  });
});
