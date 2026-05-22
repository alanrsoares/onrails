import { describe, expect, it } from "bun:test";
import { trySync } from "../src/result.js";

describe("trySync overloads", () => {
  function read(path: string): string;
  function read(path: string, encoding: "utf-8"): string;
  function read(path: string, _encoding?: string): string {
    if (path === "fail") {
      throw new Error("io");
    }
    return "data";
  }

  it("preserves callable signature for overloaded functions", () => {
    const safeRead = trySync(read, (e) => String(e));
    expect(safeRead("ok")._tag).toBe("Ok");
    expect(safeRead("fail")._tag).toBe("Err");
    expect(safeRead("ok", "utf-8")._tag).toBe("Ok");
  });
});
