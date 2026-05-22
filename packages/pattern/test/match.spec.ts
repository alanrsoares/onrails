import { describe, expect, it } from "bun:test";
import { assertNever } from "../src/assert.js";
import { match } from "../src/match.js";
import { when } from "../src/when.js";

type Provider = "ollama" | "openrouter";

type Event =
  | { type: "message"; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

describe("match", () => {
  it("matches string literal unions (direct)", () => {
    const out = match("ollama" as Provider)
      .with("ollama", () => "local")
      .with("openrouter", () => "cloud")
      .exhaustive();
    expect(out).toBe("local");
  });

  it("matches string literal unions (curried)", () => {
    const pick = match<Provider>()
      .with("ollama", () => "local")
      .with("openrouter", () => "cloud")
      .exhaustive();
    expect(pick("openrouter")).toBe("cloud");
  });

  it("matches object shapes with narrowed handlers", () => {
    const out = match({ type: "message", content: "x" } as Event)
      .with({ type: "message" }, (e) => e.content)
      .with({ type: "error" }, (e) => e.message)
      .with({ type: "done" }, () => "")
      .exhaustive();
    expect(out).toBe("x");
  });

  it("otherwise is fallback", () => {
    expect(
      match({ type: "done" } as Event)
        .with({ type: "message" }, (e) => e.content.length)
        .otherwise(() => -1),
    ).toBe(-1);
    const len = match<Event>()
      .with({ type: "message" }, (e) => e.content.length)
      .otherwise(() => -1);
    expect(len({ type: "message", content: "ab" })).toBe(2);
  });

  it("exhaustive throws on no match", () => {
    const fail = match<number>()
      .with(2, () => "two")
      .exhaustive();
    expect(() => fail(1)).toThrow("Non-exhaustive match");
  });

  it("when guard", () => {
    const sign = match<number>()
      .with(
        when((n: number) => n < 0),
        () => "neg",
      )
      .with(
        when((n: number) => n >= 0),
        () => "non-neg",
      )
      .exhaustive();
    expect(sign(-1)).toBe("neg");
    expect(sign(0)).toBe("non-neg");
  });

  it("run matches immediately", () => {
    expect(
      match({ type: "error", message: "x" } as Event)
        .with({ type: "error" }, (e) => e.message)
        .run({ type: "error", message: "net" }),
    ).toBe("net");
  });
});

describe("assertNever", () => {
  it("throws", () => {
    const x = "left" as "left" | "right";
    if (x === "left") {
      expect(x).toBe("left");
      return;
    }
    if (x === "right") {
      expect(x).toBe("right");
      return;
    }
    expect(() => assertNever(x)).toThrow("Unreachable");
  });
});
