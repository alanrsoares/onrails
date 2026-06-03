import { describe, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import type { NonExhaustiveError, RemainingCases } from "../src/exhaustive.js";
import { match } from "../src/match.js";
import { when } from "../src/when.js";

type Event =
  | { type: "message"; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

type Provider = "ollama" | "openrouter";

describe("exhaustive compile-time checks: complete unions", () => {
  it("complete discriminated union is allowed", () => {
    const out = match({ type: "done" } as Event)
      .with({ type: "message" }, (e) => e.content)
      .with({ type: "error" }, (e) => e.message)
      .with({ type: "done" }, () => "")
      .exhaustive();
    expectType<TypeEqual<typeof out, string>>(true);
  });

  it("complete literal union is allowed (curried)", () => {
    const pick = match<Provider>()
      .with("ollama", () => "local" as const)
      .with("openrouter", () => "cloud" as const)
      .exhaustive();
    expectType<(input: Provider) => "local" | "cloud">(pick);
  });

  it("withOneOf plus remaining branch is allowed", () => {
    type Job = { kind: "queued"; id: string } | { kind: "running"; id: string } | { kind: "done" };
    const out = match<Job>()
      .withOneOf([{ kind: "queued" }, { kind: "running" }], (j) => j.id)
      .with({ kind: "done" }, () => "")
      .exhaustive();
    expectType<(input: Job) => string>(out);
  });
});

describe("exhaustive compile-time checks: remaining cases tracking", () => {
  it("RemainingCases shrinks as branches are added", () => {
    type AfterOne = RemainingCases<Event, [{ type: "message"; content: string }]>;
    expectType<TypeEqual<AfterOne, { type: "error"; message: string } | { type: "done" }>>(true);

    type AfterTwo = RemainingCases<
      Event,
      [{ type: "message"; content: string }, { type: "error"; message: string }]
    >;
    expectType<TypeEqual<AfterTwo, { type: "done" }>>(true);
  });

  it("builder tracks handled cases in _handled tuple", () => {
    const builder = match<Event>()
      .with({ type: "message" }, (e) => e.content)
      .with({ type: "error" }, (e) => e.message);
    expectType<
      TypeEqual<
        (typeof builder)["_handled"],
        readonly [{ type: "message"; content: string }, { type: "error"; message: string }]
      >
    >(true);
    expectType<
      TypeEqual<ReturnType<(typeof builder)["exhaustive"]>, NonExhaustiveError<{ type: "done" }>>
    >(true);
  });
});

describe("exhaustive compile-time checks: incomplete unions", () => {
  it("incomplete discriminated union rejects exhaustive", () => {
    // @ts-expect-error — missing { type: "done" }
    const _incomplete: string = match<Event>()
      .with({ type: "message" }, (e) => e.content)
      .with({ type: "error" }, (e) => e.message)
      .exhaustive();
  });

  it("incomplete literal union rejects exhaustive", () => {
    // @ts-expect-error — missing "openrouter"
    const _incomplete: string = match<Provider>()
      .with("ollama", () => "local")
      .exhaustive();
  });

  it("no branches rejects exhaustive", () => {
    // @ts-expect-error — no cases handled
    const _empty: string = match<Event>().exhaustive();
  });
});

describe("exhaustive compile-time checks: guards", () => {
  it("type-predicate guard advances exhaustiveness", () => {
    type Msg = { type: "msg"; content: string };
    type ErrEv = { type: "err"; code: number };
    type Other = { type: "other"; raw: unknown };
    type E = Msg | ErrEv | Other;
    const isMsg = (e: E): e is Msg => e.type === "msg";

    const out = match({ type: "msg", content: "x" } as E)
      .with(when(isMsg), (e) => e.content)
      .with({ type: "err" }, (e) => String(e.code))
      .with({ type: "other" }, () => "")
      .exhaustive();
    expectType<TypeEqual<typeof out, string>>(true);
  });

  it("boolean guard does not satisfy exhaustive alone", () => {
    type N = number | string;
    // @ts-expect-error — boolean guard does not rule out string
    const _unguarded: number | string = match<N>()
      .with(
        when((v: N) => typeof v === "number"),
        (v) => v,
      )
      .exhaustive();
  });
});
