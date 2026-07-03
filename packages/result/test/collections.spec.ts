import { describe, expect, it } from "bun:test";
import { validateAll, validateTuple } from "../src/collections.js";
import { err, ok } from "../src/result.js";

describe("validation", () => {
  it("validateAll accumulates failures with a combiner", () => {
    const result = validateAll([ok(1), err(["name"]), err(["email"])], (left, right) => [
      ...left,
      ...right,
    ]);

    expect(result).toEqual(err(["name", "email"]));
  });

  it("validateAll returns all values when every result is Ok", () => {
    expect(
      validateAll([ok(1), ok(2)], (left: string, right: string) => `${left},${right}`),
    ).toEqual(ok([1, 2]));
  });

  it("validateTuple preserves values and accumulates failures", () => {
    const result = validateTuple(
      [ok(1), err(["name"]), err(["email"])] as const,
      (left: readonly string[], right: readonly string[]) => [...left, ...right],
    );

    expect(result).toEqual(err(["name", "email"]));
  });

  it("without a combiner, collects every failure into an array", () => {
    expect(validateAll([ok(1), err("name"), err("email")])).toEqual(err(["name", "email"]));
    expect(validateTuple([ok(1), err("name"), err("email")] as const)).toEqual(
      err(["name", "email"]),
    );
  });
});
