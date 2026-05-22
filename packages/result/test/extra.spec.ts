import { describe, expect, it } from "bun:test";
import {
  type AccumulateErrors,
  declareErrors,
  hasKind,
  mapErrKind,
  type UnionErrors,
} from "../src/extra.js";
import { err } from "../src/result.js";

type ParseError = { kind: "invalid"; input: string } | { kind: "empty" };
type NetError = { kind: "timeout" };

describe("extra error helpers", () => {
  it("hasKind narrows", () => {
    const e: ParseError = { kind: "invalid", input: "x" };
    expect(hasKind(e, "invalid")).toBe(true);
    if (hasKind(e, "invalid")) {
      expect(e.input).toBe("x");
    }
  });

  it("mapErrKind only maps matching kind", () => {
    const mapInvalid = mapErrKind("invalid", (e: Extract<ParseError, { kind: "invalid" }>) => ({
      kind: "mapped" as const,
      detail: e.input,
    }));
    const mapped = mapInvalid(err({ kind: "invalid", input: "z" }));
    expect(mapped).toEqual(err({ kind: "mapped", detail: "z" }));
  });

  it("UnionErrors and AccumulateErrors type helpers", () => {
    const results = [
      err<never, ParseError>({ kind: "empty" }),
      err<never, NetError>({ kind: "timeout" }),
    ] as const;
    type U = UnionErrors<typeof results>;
    type A = AccumulateErrors<[ParseError, NetError]>;
    const _u: U = { kind: "timeout" };
    const _a: A = { kind: "invalid", input: "x" };
    void _u;
    void _a;
    void results;
  });

  it("declareErrors annotates result types", () => {
    const d = declareErrors<ParseError | NetError>();
    const r = d.annotate(err({ kind: "timeout" }));
    expect(r._tag).toBe("Err");
  });
});
