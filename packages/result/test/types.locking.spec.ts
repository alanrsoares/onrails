import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { ResultAsync } from "../src/async.js";
import { errAsync, okAsync } from "../src/async-lift.js";
import { err, isErr, ok } from "../src/result.js";
import type { Result } from "../src/types.js";

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
});

describe("array payloads, async twins and the opt-out", () => {
  it("nested array literals stay mutable at every depth", () => {
    const r = ok([[1], [2, [3]]]);
    expectType<TypeEqual<typeof r, Result<[[1], [2, [3]]], never>>>(true);
    const widened: Result<(number | number[])[][], never> = r;
    expectType<Result<(number | number[])[][], never>>(widened);
  });

  it("objects inside an array literal keep their readonly literal shape", () => {
    const failure = err([{ kind: "io", paths: ["a"] }]);
    expectType<
      TypeEqual<
        typeof failure,
        Result<never, [{ readonly kind: "io"; readonly paths: readonly ["a"] }]>
      >
    >(true);
  });

  it("an annotated mutable array is left as authored", () => {
    const names: string[] = ["a"];
    const value = ok(names);
    expectType<TypeEqual<typeof value, Result<string[], never>>>(true);
  });

  it("async constructors lock literals like the sync ones", () => {
    const value = okAsync("a");
    const failure = errAsync({ kind: "io" });
    const tuple = okAsync([1, 2]);
    expectType<TypeEqual<typeof value, ResultAsync<"a", never>>>(true);
    expectType<TypeEqual<typeof failure, ResultAsync<never, { readonly kind: "io" }>>>(true);
    expectType<TypeEqual<typeof tuple, ResultAsync<[1, 2], never>>>(true);
  });

  it("both type arguments keep neverthrow's T, E order and opt out of locking", () => {
    const value = ok<number, string>(1);
    const failure = err<number, string>("bad");
    expectType<TypeEqual<typeof value, Result<number, string>>>(true);
    expectType<TypeEqual<typeof failure, Result<number, string>>>(true);
  });
});

describe("generic type parameters through the constructors", () => {
  it("an unresolved type parameter passes through without type arguments", () => {
    const lift = <T, E>(value: T): Result<T, E> => ok(value);
    const fail = <T, E>(error: E): Result<T, E> => err(error);
    const liftAsync = <T, E>(value: T): ResultAsync<T, E> => okAsync(value);
    const failAsync = <T, E>(error: E): ResultAsync<T, E> => errAsync(error);
    const toAsync = <T, E>(r: Result<T, E>): ResultAsync<T, E> =>
      isErr(r) ? errAsync(r.error) : okAsync(r.value);
    const head = <T>(rows: readonly T[]): Result<T, "not_found"> =>
      rows[0] ? ok(rows[0]) : err("not_found");
    expectType<TypeEqual<ReturnType<typeof lift<string, "io">>, Result<string, "io">>>(true);
    expectType<TypeEqual<ReturnType<typeof fail<number, "io">>, Result<number, "io">>>(true);
    expectType<TypeEqual<ReturnType<typeof liftAsync<1, 2>>, ResultAsync<1, 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof failAsync<1, 2>>, ResultAsync<1, 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof toAsync<1, 2>>, ResultAsync<1, 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof head<1>>, Result<1, "not_found">>>(true);
  });

  it("ResultAsync.of passes a generic through like ResultAsync.ok", () => {
    const lift = <T, E>(value: T): ResultAsync<T, E> => ResultAsync.of(value);
    expectType<TypeEqual<ReturnType<typeof lift<1, 2>>, ResultAsync<1, 2>>>(true);
  });

  it("array-constrained type parameters pass through without type arguments", () => {
    const mutable = <T extends unknown[], E>(value: T): Result<T, E> => ok(value);
    const readonly = <T extends readonly unknown[], E>(value: T): Result<T, E> => ok(value);
    const nested = <T extends string[][], E>(value: T): Result<T, E> => ok(value);
    const tuple = <T extends [string, number], E>(value: T): Result<T, E> => ok(value);
    const failArr = <T, E extends unknown[]>(error: E): ResultAsync<T, E> => errAsync(error);
    expectType<TypeEqual<ReturnType<typeof mutable<[1], 2>>, Result<[1], 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof readonly<readonly [1], 2>>, Result<readonly [1], 2>>>(
      true,
    );
    expectType<TypeEqual<ReturnType<typeof nested<[["a"]], 2>>, Result<[["a"]], 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof tuple<["a", 1], 2>>, Result<["a", 1], 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof failArr<1, [2]>>, ResultAsync<1, [2]>>>(true);
  });

  it("a generic element inside an array literal keeps its type parameter", () => {
    const one = <T, E>(value: T): Result<T[], E> => ok([value]);
    const pair = <T, E>(value: T): Result<[T, T], E> => ok([value, value]);
    expectType<TypeEqual<ReturnType<typeof one<1, 2>>, Result<1[], 2>>>(true);
    expectType<TypeEqual<ReturnType<typeof pair<1, 2>>, Result<[1, 1], 2>>>(true);
  });
});
