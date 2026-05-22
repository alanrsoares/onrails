import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { ResultAsync } from "../src/async.js";
import type { ErrOf, OkOf, UnionErrors } from "../src/extra.js";
import { fromAsync, type InferErr, type InferOk } from "../src/interop.js";
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
  matchWith,
  ok,
  trySync,
  unwrapOr,
} from "../src/result.js";
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

  it("unwrapOr returns Ok type on success", () => {
    const v = unwrapOr(ok(1), 0);
    expectType<TypeEqual<typeof v, number>>(true);
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
