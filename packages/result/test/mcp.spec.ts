import { describe, expect, it } from "bun:test";
import { extractFetchErrorDetail, toToolResponse, unwrapFetchResult } from "../src/mcp.js";
import { err, ok } from "../src/result.js";

describe("mcp helpers", () => {
  it("unwrapFetchResult maps missing data to Err", () => {
    const r = unwrapFetchResult(
      { data: undefined, error: { msg: "x" }, response: new Response(null, { status: 404 }) },
      ({ error, response }) => ({ status: response.status, detail: String(error) }),
    );
    expect(r._tag).toBe("Err");
  });

  it("unwrapFetchResult returns Ok on data", () => {
    const r = unwrapFetchResult({ data: { id: "1" }, response: new Response() }, () => ({
      status: 0,
      detail: "x",
    }));
    expect(r).toEqual(ok({ id: "1" }));
  });

  it("toToolResponse formats success and error", () => {
    expect(toToolResponse(ok({ a: 1 })).structuredContent).toEqual({ a: 1 });
    expect(toToolResponse(err({ message: "fail" })).isError).toBe(true);
  });

  it("extractFetchErrorDetail detects HTML bodies", () => {
    const detail = extractFetchErrorDetail("<html>", new Response(null, { status: 403 }));
    expect(detail).toContain("CDN");
  });
});
