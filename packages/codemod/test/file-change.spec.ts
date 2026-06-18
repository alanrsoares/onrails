import { describe, expect, it } from "bun:test";
import { none } from "@onrails/maybe";
import { computeFileChange, toFileChange } from "../src/file-change.js";

const COMPAT = "@onrails/result/compat/neverthrow";
const NATIVE = "@onrails/result";

describe("computeFileChange — compat mode", () => {
  it("returns none when the file never imports neverthrow", () => {
    expect(computeFileChange(`import { z } from "zod";\n`, "compat")).toEqual(none());
  });

  it("rewrites static neverthrow imports to the compat spec", () => {
    const m = computeFileChange(`import { ok } from "neverthrow";\n`, "compat");
    expect(m._tag).toBe("Some");
    if (m._tag !== "Some") return;
    expect(m.value.next).toBe(`import { ok } from "${COMPAT}";\n`);
    expect(m.value.before).toBe(1);
    expect(m.value.changed).toBe(true);
    expect(m.value.warnings).toEqual([]);
  });

  it("rewrites dynamic import() specifiers", () => {
    const m = computeFileChange(`const m = await import("neverthrow");\n`, "compat");
    expect(m._tag).toBe("Some");
    if (m._tag !== "Some") return;
    expect(m.value.next).toContain(`import("${COMPAT}")`);
  });
});

describe("computeFileChange — native mode", () => {
  it("returns none for a file with nothing to migrate and no warnings", () => {
    expect(computeFileChange("const x = 1;\n", "native")).toEqual(none());
  });

  it("rewrites compat imports to the native spec", () => {
    const m = computeFileChange(`import { ok } from "${COMPAT}";\n`, "native");
    expect(m._tag).toBe("Some");
    if (m._tag !== "Some") return;
    expect(m.value.next).toBe(`import { ok } from "${NATIVE}";\n`);
    expect(m.value.changed).toBe(true);
  });

  it("surfaces warnings even when no rewrite applies", () => {
    const m = computeFileChange("const v = result.value;\n", "native");
    expect(m._tag).toBe("Some");
    if (m._tag !== "Some") return;
    expect(m.value.changed).toBe(false);
    expect(m.value.warnings.map((w) => w.label)).toContain("compat value/error property");
  });
});

describe("toFileChange", () => {
  it("projects a computed change onto its path", () => {
    const computed = {
      next: "src",
      before: 2,
      after: 1,
      changed: true,
      warnings: [],
    };
    expect(toFileChange("a/b.ts", computed)).toEqual({
      path: "a/b.ts",
      before: 2,
      after: 1,
      changed: true,
      warnings: [],
    });
  });
});
