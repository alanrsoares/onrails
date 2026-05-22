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

  it("withOneOf shares a handler across patterns", () => {
    type Job =
      | { kind: "queued"; id: string }
      | { kind: "running"; id: string }
      | { kind: "done"; ok: boolean };
    const active = (j: { kind: "queued" | "running"; id: string }) => j.id;
    const out = match({ kind: "running", id: "j1" } as Job)
      .withOneOf([{ kind: "queued" }, { kind: "running" }], active)
      .with({ kind: "done" }, (j) => (j.ok ? "yes" : "no"))
      .exhaustive();
    expect(out).toBe("j1");
  });

  it("withEither is sugar for two patterns", () => {
    const pick = match<Provider>()
      .withEither("ollama", "openrouter", (p) => p)
      .exhaustive();
    expect(pick("ollama")).toBe("ollama");
    expect(pick("openrouter")).toBe("openrouter");
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

  it("returnType locks accumulator and runs", () => {
    type Part = { type: "text"; text: string } | { type: "image"; src: string };
    const render = (p: Part) =>
      match(p)
        .returnType<string>()
        .with({ type: "text" }, (e) => e.text)
        .with({ type: "image" }, (e) => e.src)
        .exhaustive();
    expect(render({ type: "text", text: "hi" })).toBe("hi");
    expect(render({ type: "image", src: "u" })).toBe("u");
  });

  it("returnType supports otherwise", () => {
    type P = "a" | "b" | "c";
    const fn = match<P>()
      .returnType<number>()
      .with("a", () => 1)
      .otherwise(() => -1);
    expect(fn("a")).toBe(1);
    expect(fn("b")).toBe(-1);
  });

  it("returnType supports curried exhaustive", () => {
    type P = "a" | "b";
    const fn = match<P>()
      .returnType<number>()
      .with("a", () => 1)
      .with("b", () => 2)
      .exhaustive();
    expect(fn("a")).toBe(1);
    expect(fn("b")).toBe(2);
  });

  it("void-returning handlers count as matched (no false non-exhaustive)", () => {
    type Event = { kind: "a" } | { kind: "b" } | { kind: "c" };
    const seen: string[] = [];
    const dispatch = (e: Event) =>
      match(e)
        .with({ kind: "a" }, () => {
          seen.push("a");
        })
        .with({ kind: "b" }, () => {
          seen.push("b");
        })
        .with({ kind: "c" }, () => {
          seen.push("c");
        })
        .exhaustive();
    dispatch({ kind: "a" });
    dispatch({ kind: "b" });
    dispatch({ kind: "c" });
    expect(seen).toEqual(["a", "b", "c"]);
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
