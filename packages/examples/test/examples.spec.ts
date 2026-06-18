import { describe, expect, it } from "bun:test";
import { isOk, unwrapOk } from "../../result/src/index.js";
import { checkout, message } from "../src/combined.js";
import { label } from "../src/maybe.js";
import { view } from "../src/pattern.js";
import { checkout as railwayCheckout } from "../src/railway.js";
import { getUser, respond } from "../src/result.js";

describe("doc snippet: result", () => {
  it("fetches and decodes a user", async () => {
    const r = await getUser("u1");
    expect(isOk(r)).toBe(true);
  });

  it("maps the outcome to a response", async () => {
    expect(await respond("u1")).toEqual({
      status: 200,
      body: { id: "u1", name: "Ada", displayName: "Ada Lovelace", active: true, address: null },
    });
  });
});

describe("doc snippet: pattern", () => {
  it("renders each variant exhaustively", () => {
    expect(view({ status: "loading" })).toBe("<spinner />");
    expect(view({ status: "empty" })).toBe("<p>No posts yet</p>");
    expect(view({ status: "ok", posts: [{ id: "p1", title: "t" }] })).toBe("<ul>1 posts</ul>");
    expect(view({ status: "error", code: 500 })).toBe("<p>Failed (500)</p>");
  });
});

describe("doc snippet: maybe", () => {
  it("walks nullable fields with a fallback", () => {
    expect(label).toBe("LONDON");
  });
});

describe("doc snippet: combined", () => {
  it("runs the checkout do-notation", () => {
    const r = checkout("u1");
    expect(isOk(r)).toBe(true);
    expect(message).toBe("Order rcpt_1 confirmed");
  });

  it("short-circuits on an unknown user", () => {
    expect(checkout("nope")._tag).toBe("Err");
  });
});

describe("doc snippet: railway", () => {
  it("threads the context to a result", () => {
    const r = railwayCheckout("u1");
    expect(isOk(r)).toBe(true);
    expect(unwrapOk(r)).toEqual({ orderId: "rcpt_1", customer: "Ada" });
  });

  it("short-circuits on an unknown user", () => {
    expect(railwayCheckout("nope")._tag).toBe("Err");
  });
});
