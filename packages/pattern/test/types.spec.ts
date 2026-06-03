import { describe, it } from "bun:test";
import { ok, type Result } from "@onrails/result";
import { expectType, type TypeEqual } from "ts-expect";
import { match } from "../src/match.js";
import type { Narrow, NarrowUnion } from "../src/narrow.js";
import { matchTag } from "../src/tag.js";
import { when } from "../src/when.js";

type Provider = "ollama" | "openrouter";

type Event =
  | { type: "message"; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

describe("pattern types: narrow", () => {
  it("Narrow extracts discriminated members", () => {
    type Msg = Narrow<Event, { type: "message" }>;
    expectType<TypeEqual<Msg, { type: "message"; content: string }>>(true);
    type ErrEv = Narrow<Event, { type: "error" }>;
    expectType<TypeEqual<ErrEv, { type: "error"; message: string }>>(true);
  });

  it("NarrowUnion unions per-pattern narrowings", () => {
    type Active = NarrowUnion<Event, readonly [{ type: "message" }, { type: "error" }]>;
    expectType<
      TypeEqual<Active, { type: "message"; content: string } | { type: "error"; message: string }>
    >(true);
  });

  it("Narrow falls back to intersection on single-object T", () => {
    type Job = {
      id: string;
      status: "queued" | "running" | "failed" | "canceled" | "succeeded";
      errorMessage: string | null;
    };
    type FailedJob = Job & { status: "failed" };
    type Narrowed = Narrow<Job, { status: "failed" }>;
    expectType<TypeEqual<Narrowed, FailedJob>>(true);
  });
});

describe("pattern types: match builder", () => {
  it("withOneOf narrows handler input to union of members", () => {
    type Job = { kind: "queued"; id: string } | { kind: "running"; id: string } | { kind: "done" };
    match<Job>()
      .withOneOf([{ kind: "queued" }, { kind: "running" }], (j) => {
        expectType<
          TypeEqual<typeof j, { kind: "queued"; id: string } | { kind: "running"; id: string }>
        >(true);
        return j.id;
      })
      .with({ kind: "done" }, () => "");
  });

  it("withEither narrows two-pattern union", () => {
    match<Provider>()
      .withEither("ollama", "openrouter", (p) => {
        expectType<TypeEqual<typeof p, Provider>>(true);
        return p;
      })
      .exhaustive();
  });

  it("exhaustive on literal union returns handler union", () => {
    const out = match("ollama" as Provider)
      .with("ollama", () => "local" as const)
      .with("openrouter", () => "cloud" as const)
      .exhaustive();
    expectType<TypeEqual<typeof out, "local" | "cloud">>(true);
  });

  it("curried exhaustive returns a function", () => {
    const pick = match<Provider>()
      .with("ollama", () => "local")
      .with("openrouter", () => "cloud")
      .exhaustive();
    expectType<(input: Provider) => string>(pick);
  });

  it("object .with narrows handler input", () => {
    match<Event>()
      .with({ type: "message" }, (e) => {
        expectType<TypeEqual<typeof e, { type: "message"; content: string }>>(true);
        return e.content;
      })
      .with({ type: "error" }, (e) => {
        expectType<TypeEqual<typeof e, { type: "error"; message: string }>>(true);
        return e.message;
      })
      .with({ type: "done" }, () => "");
  });

  it("otherwise on bound input returns R", () => {
    const n = match({ type: "done" } as Event)
      .with({ type: "message" }, (e) => e.content.length)
      .otherwise(() => -1);
    expectType<TypeEqual<typeof n, number>>(true);
  });
});

describe("pattern types: returnType", () => {
  it("returnType locks the accumulator to R", () => {
    type Part = { type: "text"; text: string } | { type: "image"; src: string };
    const render = (p: Part) =>
      match(p)
        .returnType<string>()
        .with({ type: "text" }, (e) => e.text)
        .with({ type: "image" }, (e) => e.src)
        .exhaustive();
    expectType<TypeEqual<ReturnType<typeof render>, string>>(true);
  });

  it("returnType supports otherwise and stays locked", () => {
    type Provider2 = "ollama" | "openrouter" | "anthropic";
    const fn = match<Provider2>()
      .returnType<number>()
      .with("ollama", () => 1)
      .otherwise(() => 0);
    expectType<(input: Provider2) => number>(fn);
  });

  it("returnType narrows handler input via object pattern", () => {
    match<Event>()
      .returnType<string>()
      .with({ type: "message" }, (e) => {
        expectType<TypeEqual<typeof e, { type: "message"; content: string }>>(true);
        return e.content;
      })
      .with({ type: "error" }, (e) => {
        expectType<TypeEqual<typeof e, { type: "error"; message: string }>>(true);
        return e.message;
      })
      .with({ type: "done" }, () => "");
  });
});

describe("pattern types: guards", () => {
  it("when() narrows via type predicate", () => {
    type Msg = { type: "msg"; content: string };
    type ErrEv = { type: "err"; code: number };
    type Other = { type: "other"; raw: unknown };
    type E = Msg | ErrEv | Other;
    const isMsg = (e: E): e is Msg => e.type === "msg";
    match({ type: "msg", content: "x" } as E)
      .with(when(isMsg), (e) => {
        expectType<TypeEqual<typeof e, Msg>>(true);
        return e.content;
      })
      .otherwise(() => "");
  });

  it("when() plain boolean guard leaves T unnarrowed", () => {
    type N = number | string;
    match(1 as N)
      .with(
        when((v: N) => typeof v === "number" && v > 0),
        (v) => {
          expectType<TypeEqual<typeof v, N>>(true);
          return v;
        },
      )
      .otherwise(() => 0);
  });

  it("matchTag narrows each _tag branch", () => {
    matchTag(ok(1) as Result<number, string>, {
      Ok: (v) => {
        expectType<TypeEqual<typeof v.value, number>>(true);
        return v.value;
      },
      Err: (e) => {
        expectType<TypeEqual<typeof e.error, string>>(true);
        return e.error;
      },
    });
  });
});
