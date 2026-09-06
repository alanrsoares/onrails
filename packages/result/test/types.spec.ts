import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { ResultAsync } from "../src/async.js";
import { asyncAfter, errAsync, fromAsync, fromResult, tryAsync } from "../src/async-lift.js";
import { combine, combineTuple, validateAll, validateTuple } from "../src/collections.js";
import type { ErrOf, OkOf, UnionErrors } from "../src/extra.js";
import type { InferErr, InferOk } from "../src/internal/infer.js";
import { Railway } from "../src/railway.js";
import {
  bimap,
  err,
  flatMap,
  fromThrowable,
  isErr,
  isOk,
  map,
  mapErr,
  match,
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

describe("Result sync types: core", () => {
  it("ok and err preserve type params", () => {
    const success = ok(1);
    const failure = err("x");
    expectType<TypeEqual<typeof success, Result<1, never>>>(true);
    expectType<TypeEqual<typeof failure, Result<never, "x">>>(true);
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
});

describe("Result sync types: mapping", () => {
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
    expectType<TypeEqual<typeof r, Result<string, "parse" | { readonly kind: "zero" }>>>(true);
  });
});

describe("Result sync types: match", () => {
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
});

describe("Result sync types: unwrap and combine", () => {
  it("unwrapOr returns Ok type on success", () => {
    const v = unwrapOr(ok(1), 0);
    expectType<TypeEqual<typeof v, 1 | 0>>(true);
  });

  it("unwrapOr widens to T | U when the fallback differs from the Ok type", () => {
    const port = ok(8080) as Result<number, string>;

    const dataFirst = unwrapOr(port, null);
    expectType<TypeEqual<typeof dataFirst, number | null>>(true);

    const curried = unwrapOr(null)(port);
    expectType<TypeEqual<typeof curried, number | null>>(true);
  });

  it("unwrap helpers return the unwrapped side type", () => {
    const okValue = unwrapOk(ok(1) as Result<number, string>);
    const errValue = unwrapErr(err("x") as Result<number, string>);
    expectType<TypeEqual<typeof okValue, number>>(true);
    expectType<TypeEqual<typeof errValue, string>>(true);
  });

  it("combine collects values or first Err", () => {
    const r = combine([ok(1), ok(2)]);
    expectType<TypeEqual<typeof r, Result<(1 | 2)[], never>>>(true);
    const failed = combine([ok(1), err("x")]);
    expectType<TypeEqual<typeof failed, Result<1[], "x">>>(true);
  });

  it("combineTuple preserves tuple shape from inline literals", () => {
    // No `as const`, no hoisted intermediates: the parameter is a bare `R`, so
    // nothing contextually widens `ok()`'s defaulted `E = never`.
    const r = combineTuple([ok(1), ok("a")]);
    expectType<TypeEqual<typeof r, Result<readonly [1, "a"], never>>>(true);
  });

  it("combineTuple keeps both channels precise for a mixed inline tuple", () => {
    const r = combineTuple([ok(1), err("boom")]);
    expectType<TypeEqual<typeof r, Result<readonly [1, never], "boom">>>(true);
  });

  it("tuple combinators reject a non-Result element at the call site", () => {
    // @ts-expect-error the TupleGuard demands an extra argument that cannot be supplied
    combineTuple([ok(1), 42]);
    // @ts-expect-error same guard on the accumulating twin
    validateTuple([ok(1), 42]);
  });
});

describe("Result sync types: effects", () => {
  it("fromThrowable preserves function arity and return", () => {
    const safe = fromThrowable(
      (a: number, b: string) => a + b.length,
      (e) => String(e),
    );
    expectType<(a: number, b: string) => Result<number, string>>(safe);
  });

  it("trySync runs eagerly and defaults its error to Error", () => {
    const defaulted = trySync(() => 1);
    expectType<TypeEqual<typeof defaulted, Result<number, Error>>>(true);

    const mapped = trySync(
      () => 1,
      (e) => String(e),
    );
    expectType<TypeEqual<typeof mapped, Result<number, string>>>(true);
  });

  it("recover maps only the Err track", () => {
    const r = recover(err("x") as Result<number, string>, (error) =>
      error.length > 0 ? ok(0) : err({ kind: "empty" as const }),
    );
    expectType<TypeEqual<typeof r, Result<number, { readonly kind: "empty" }>>>(true);

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
    expectType<TypeEqual<typeof ra, ResultAsync<1, never>>>(true);
    expectType<TypeEqual<typeof rb, ResultAsync<never, "x">>>(true);
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

  it("combineTuple and combineTupleParallel preserve tuple shape and union errors", () => {
    const a = ResultAsync.ok<number, "a">(1);
    const b = ResultAsync.ok<string, "b">("x");
    const combined = ResultAsync.combineTuple([a, b]);
    const paralleled = ResultAsync.combineTupleParallel([a, b]);

    expectType<TypeEqual<typeof combined, ResultAsync<readonly [number, string], "a" | "b">>>(true);
    expectType<TypeEqual<typeof paralleled, ResultAsync<readonly [number, string], "a" | "b">>>(
      true,
    );
  });

  it("flatMap unions errors from inner Result", () => {
    const ra = ResultAsync.ok(1).flatMap((n) =>
      n > 0 ? ok(String(n)) : err({ code: 1 as const }),
    );
    expectType<TypeEqual<typeof ra, ResultAsync<string, { readonly code: 1 }>>>(true);
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

    expectType<TypeEqual<typeof recovered, ResultAsync<number, { readonly kind: "empty" }>>>(true);
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
    const r = validateAll([ok(1), err("a" as const), err("b" as const)]);
    expectType<TypeEqual<typeof r, Result<1[], readonly ("a" | "b")[]>>>(true);
  });

  it("tuple validation preserves tuple values and accumulates errors", () => {
    const r = validateTuple([ok(1), ok("x"), err("bad" as const)]);
    expectType<TypeEqual<typeof r, Result<readonly [1, "x", never], readonly "bad"[]>>>(true);
  });
});

describe("Railway types: fluent", () => {
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
});

describe("Railway types: context shape and key collisions", () => {
  it("flattens the accumulated context instead of chaining intersections", () => {
    const out = Railway.fromResult("id", () => ok("profile-1" as const))
      .derive("slug", ({ id }) => `${id}-slug`)
      .done();

    expectType<TypeEqual<typeof out, Result<{ id: "profile-1"; slug: string }, never>>>(true);
  });

  it("preserves optional and readonly modifiers on a seeded context", () => {
    const base = { a: 1 } as { a?: number; readonly b: string };
    const out = Railway.context(base)
      .derive("c", () => true)
      .done();

    expectType<
      TypeEqual<typeof out, Result<{ a?: number; readonly b: string; c: boolean }, never>>
    >(true);
  });

  it("rejects a step whose key already exists in the context", () => {
    Railway.empty()
      .derive("x", () => 1)
      // @ts-expect-error FreshKey demands an unsatisfiable extra argument for a duplicate key
      .derive("x", () => "two");
  });

  it("rejects a parallel branch key that collides with the context", () => {
    // @ts-expect-error FreshKeys flags "recent" as already present
    Railway.context({ recent: 1 }).parallel({ recent: () => ResultAsync.ok([1]) });
  });
});

describe("Railway types: end-to-end", () => {
  it("full workflow chains unions errors and merges parallel outputs", () => {
    const out = Railway.fromSync(
      "profileId",
      () => " profile-1 ".trim() as "profile-1",
      () => "parse" as const,
    )
      .fromPromise(
        "row",
        ({ profileId }) =>
          Promise.resolve<{ id: "profile-1"; name: "Ada" } | null>({
            id: profileId,
            name: "Ada",
          }),
        () => "db" as const,
      )
      .require("profile", "row", () => "missing" as const)
      .derive("normalized", ({ profile }) => profile.id)
      .parallel({
        recent: ({ normalized }) => ResultAsync.ok([normalized]),
        metrics: () => ResultAsync.ok({ jobs: 2 }),
      })
      .select(({ normalized, recent, metrics }) => ({ normalized, recent, metrics }));

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

describe("literal locking and err.as", () => {
  it("ok and err lock inline literals instead of widening", () => {
    const value = ok("a");
    const failure = err({ kind: "io" });
    expectType<TypeEqual<typeof value, Result<"a", never>>>(true);
    expectType<TypeEqual<typeof failure, Result<never, { readonly kind: "io" }>>>(true);
  });

  it("locking does not leak through an annotated value", () => {
    const raw: string = "a";
    const value = ok(raw);
    expectType<TypeEqual<typeof value, Result<string, never>>>(true);
  });

  it("array literals stay assignable to a mutable array payload", () => {
    const r = ok([1, 2]);
    expectType<TypeEqual<typeof r, Result<[1, 2], never>>>(true);
    const widened: Result<number[], never> = r;
    expectType<TypeEqual<typeof widened, Result<number[], never>>>(true);
  });

  it("an unbounded readonly array payload is left as authored", () => {
    const names: readonly string[] = ["a"];
    const value = ok(names);
    expectType<TypeEqual<typeof value, Result<readonly string[], never>>>(true);
  });

  it("a single type argument on err names the error channel", () => {
    type AppError = { kind: "parse" } | { kind: "io" };
    const failure = err<AppError>({ kind: "io" });
    const asyncFailure = errAsync<AppError>({ kind: "io" });
    expectType<TypeEqual<typeof failure, Result<never, AppError>>>(true);
    expectType<TypeEqual<typeof asyncFailure, ResultAsync<never, AppError>>>(true);
  });

  it("both type arguments keep neverthrow's T, E order and opt out of locking", () => {
    const value = ok<number, string>(1);
    const failure = err<number, string>("bad");
    expectType<TypeEqual<typeof value, Result<number, string>>>(true);
    expectType<TypeEqual<typeof failure, Result<number, string>>>(true);
  });
});
