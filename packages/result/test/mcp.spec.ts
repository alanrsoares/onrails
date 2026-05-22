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
    const okResp = toToolResponse(ok({ a: 1 }));
    if (!("isError" in okResp)) {
      expect(okResp.structuredContent).toEqual({ a: 1 });
    }
    const errResp = toToolResponse(err({ message: "fail" }));
    if ("isError" in errResp) {
      expect(errResp.isError).toBe(true);
    }
  });
});

describe("extractFetchErrorDetail", () => {
  const r = (status: number, statusText = "") => new Response(null, { status, statusText });

  type MatchKind = "contain" | "match";
  type Case = {
    label: string;
    error: unknown;
    response: Response;
    expected: string | RegExp;
    kind: MatchKind;
  };
  const cases: Case[] = [
    {
      label: "null error falls back to statusText",
      error: null,
      response: r(500, "Internal Server Error"),
      expected: "Internal Server Error",
      kind: "contain",
    },
    {
      label: "undefined error with empty statusText",
      error: undefined,
      response: r(500, ""),
      expected: "unknown error",
      kind: "contain",
    },
    {
      label: "html body, status 403 → CDN/WAF hint",
      error: "<html>boom</html>",
      response: r(403),
      expected: /CDN\/WAF/,
      kind: "match",
    },
    {
      label: "doctype body, status 502 → generic HTML hint",
      error: "<!DOCTYPE html><html></html>",
      response: r(502),
      expected: /unexpected HTML response \(502\)/,
      kind: "match",
    },
    {
      label: "plain string error passes through",
      error: "boom",
      response: r(400),
      expected: "boom",
      kind: "contain",
    },
    {
      label: "object error serialised as JSON",
      error: { code: "x", msg: "fail" },
      response: r(400),
      expected: /"code":"x"/,
      kind: "match",
    },
    {
      label: "number error stringified",
      error: 42,
      response: r(400),
      expected: "42",
      kind: "contain",
    },
  ];

  it.each(cases)("$label", ({ error, response, expected, kind }) => {
    const detail = extractFetchErrorDetail(error, response);
    if (kind === "match") expect(detail).toMatch(expected as RegExp);
    else expect(detail).toContain(expected as string);
  });
});
