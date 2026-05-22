import { describe, it } from "bun:test";
import { ok, type Result } from "@onrails/result";
import { expectType, type TypeEqual } from "ts-expect";
import { match } from "../src/match.js";
import type { Narrow } from "../src/narrow.js";
import { matchTag } from "../src/tag.js";

type Provider = "ollama" | "openrouter";

type Event =
  | { type: "message"; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

describe("pattern types", () => {
  it("Narrow extracts discriminated members", () => {
    type Msg = Narrow<Event, { type: "message" }>;
    expectType<TypeEqual<Msg, { type: "message"; content: string }>>(true);
    type ErrEv = Narrow<Event, { type: "error" }>;
    expectType<TypeEqual<ErrEv, { type: "error"; message: string }>>(true);
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
