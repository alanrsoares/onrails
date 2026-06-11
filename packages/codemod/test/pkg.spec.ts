import { describe, expect, it } from "bun:test";
import { none } from "@onrails/maybe";
import { isErr, isOk, unwrapOk } from "@onrails/result";
import { computePkgRewrite, parsePackageJson } from "../src/pkg.js";

describe("parsePackageJson", () => {
  it("parses valid JSON into a record", () => {
    const r = parsePackageJson(`{"name":"app"}`);
    expect(isOk(r)).toBe(true);
    expect(unwrapOk(r)).toEqual({ name: "app" });
  });

  it("returns Err<Error> on malformed JSON", () => {
    const r = parsePackageJson("{nope");
    expect(isErr(r)).toBe(true);
  });
});

describe("computePkgRewrite", () => {
  const path = "/repo/app/package.json";
  const onrailsAbs = "/repo/vendor/onrails";

  it("returns none when no dependency key mentions neverthrow", () => {
    const json = { name: "app", dependencies: { zod: "^3.0.0" } };
    expect(computePkgRewrite(json, path, onrailsAbs)).toEqual(none());
  });

  it("swaps neverthrow for a relative file: spec and sorts deps", () => {
    const json = {
      name: "app",
      dependencies: { zod: "^3.0.0", neverthrow: "^6.0.0" },
    };
    const m = computePkgRewrite(json, path, onrailsAbs);
    expect(m._tag).toBe("Some");
    if (m._tag !== "Some") return;
    expect(m.value.fileSpec).toBe("file:../vendor/onrails");
    expect(m.value.removed).toEqual(["dependencies"]);
    expect(m.value.json.dependencies).toEqual({
      "@onrails/result": "file:../vendor/onrails",
      zod: "^3.0.0",
    });
  });

  it("rewrites every dependency key that lists neverthrow", () => {
    const json = {
      dependencies: { neverthrow: "^6.0.0" },
      devDependencies: { neverthrow: "^6.0.0" },
      peerDependencies: { typescript: "^5.0.0" },
    };
    const m = computePkgRewrite(json, path, onrailsAbs);
    expect(m._tag).toBe("Some");
    if (m._tag !== "Some") return;
    expect(m.value.removed).toEqual(["dependencies", "devDependencies"]);
    expect(m.value.json.peerDependencies).toEqual({ typescript: "^5.0.0" });
  });
});
