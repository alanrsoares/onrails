import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { parallelTupleAsync, ResultAsync, sequenceTupleAsync, tryAsync } from "../src/async.js";
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
  bimap,
  combine,
  combineTuple,
  err,
  flatMap,
  fold,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  type matchResult,
  ok,
  recover,
  tap,
  tapErr,
  trySync,
  unwrapErr,
  unwrapOk,
  unwrapOr,
} from "../src/result.js";
import { $, tryGen, yieldResult } from "../src/try-gen.js";
import type { Err, Ok, Result, UnexpectedError } from "../src/types.js";
import { validateAllArray, validateTupleArray } from "../src/validation.js";

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

  it("map and curried map change Ok type", () => {
    const r = map(ok(1), (n) => String(n));
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

  it("flatMap unions error types", () => {
    const r = flatMap((n: number) => (n > 0 ? ok(String(n)) : err("inner" as const)))(
      err("outer" as const) as Result<number, "outer">,
    );
    expectType<TypeEqual<typeof r, Result<string, "outer" | "inner">>>(true);
  });

  it("flatMap unions errors", () => {
    const r = flatMap(ok(1) as Result<number, "parse">, (n) =>
      n > 0 ? ok(String(n)) : err({ kind: "zero" as const }),
    );
    expectType<TypeEqual<typeof r, Result<string, "parse" | { kind: "zero" }>>>(true);
  });

  it("match preserves handler return type", () => {
    const out = match(
      ok(1),
      (v) => v + 1,
      () => 0,
    );
    expectType<TypeEqual<typeof out, number>>(true);
    const curried = match(
      (v: number) => v + 1,
      () => 0,
    )(ok(1));
    expectType<TypeEqual<typeof curried, number>>(true);
  });

  it("fold preserves handler return type", () => {
    const curried = fold({
      ok: (value: number) => value + 1,
      err: () => 0,
    })(ok(1) as Result<number, string>);
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

  it("recover maps only the Err track", () => {
    const r = recover(err("x") as Result<number, string>, (error) =>
      error.length > 0 ? ok(0) : err({ kind: "empty" as const }),
    );
    expectType<TypeEqual<typeof r, Result<number, { kind: "empty" }>>>(true);

    const curried = recover((error: string) => ok(error.length))(
      err("x") as Result<number, string>,
    );
    expectType<TypeEqual<typeof curried, Result<number, never>>>(true);
  });

  it("tap helpers preserve Result types", () => {
    const r = tap(ok(1) as Result<number, string>, () => undefined);
    const re = tapErr(err("x") as Result<number, string>, () => undefined);
    const curried = tap((value: number) => value)(ok(1) as Result<number, string>);
    const curriedErr = tapErr((error: string) => error)(err("x") as Result<number, string>);

    expectType<TypeEqual<typeof r, Result<number, string>>>(true);
    expectType<TypeEqual<typeof re, Result<number, string>>>(true);
    expectType<TypeEqual<typeof curried, Result<number, string>>>(true);
    expectType<TypeEqual<typeof curriedErr, Result<number, string>>>(true);
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

  it("sequence and parallel tuple aliases preserve tuple shape and union errors", () => {
    const a = ResultAsync.ok<number, "a">(1);
    const b = ResultAsync.ok<string, "b">("x");
    const sequenced = sequenceTupleAsync([a, b] as const);
    const paralleled = parallelTupleAsync([a, b] as const);

    expectType<TypeEqual<typeof sequenced, ResultAsync<readonly [number, string], "a" | "b">>>(
      true,
    );
    expectType<TypeEqual<typeof paralleled, ResultAsync<readonly [number, string], "a" | "b">>>(
      true,
    );
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

  it("recover and tap preserve async track types", () => {
    const recovered = ResultAsync.err<number, string>("x").recover((error) =>
      error.length > 0 ? ResultAsync.ok(0) : ResultAsync.err({ kind: "empty" as const }),
    );
    const tapped = ResultAsync.ok<number, string>(1).tap(() => undefined);
    const tappedErr = ResultAsync.err<number, string>("x").tapErr(() => undefined);

    expectType<TypeEqual<typeof recovered, ResultAsync<number, { kind: "empty" }>>>(true);
    expectType<TypeEqual<typeof tapped, ResultAsync<number, string>>>(true);
    expectType<TypeEqual<typeof tappedErr, ResultAsync<number, string>>>(true);
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

describe("Result validation types", () => {
  it("array validation accumulates errors", () => {
    const r = validateAllArray([ok(1), err("a" as const), err("b" as const)]);
    expectType<TypeEqual<typeof r, Result<number[], readonly ("a" | "b")[]>>>(true);
  });

  it("tuple validation preserves tuple values and accumulates errors", () => {
    const a = ok(1);
    const b = ok("x");
    const c = err("bad" as const);
    const r = validateTupleArray([a, b, c] as const);
    expectType<TypeEqual<typeof r, Result<readonly [number, string, never], readonly "bad"[]>>>(
      true,
    );
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
