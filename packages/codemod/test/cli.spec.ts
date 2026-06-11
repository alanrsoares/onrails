import { describe, expect, it } from "bun:test";
import { isErr, isOk, unwrapOk } from "@onrails/result";
import { parseArgs } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses target with defaults", () => {
    const r = parseArgs(["/tmp/app"]);
    expect(isOk(r)).toBe(true);
    const args = unwrapOk(r);
    expect(args.target).toBe("/tmp/app");
    expect(args.dry).toBe(false);
    expect(args.mode).toBe("compat");
  });

  it("parses flags in any position", () => {
    const r = parseArgs(["--dry", "/tmp/app", "--to-native"]);
    const args = unwrapOk(r);
    expect(args.dry).toBe(true);
    expect(args.mode).toBe("native");
  });

  it("resolves --onrails to an absolute path", () => {
    const args = unwrapOk(parseArgs(["/tmp/app", "--onrails=/vendor/onrails"]));
    expect(args.onrails).toBe("/vendor/onrails");
  });

  it("returns Err with usage when no target is given", () => {
    const r = parseArgs(["--dry"]);
    expect(isErr(r)).toBe(true);
  });

  it("returns Err with usage on multiple targets", () => {
    expect(isErr(parseArgs(["a", "b"]))).toBe(true);
  });
});
