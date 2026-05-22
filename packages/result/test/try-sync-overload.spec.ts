import { describe, expect, it } from "bun:test";
import { trySync } from "../src/result.js";

describe("trySync overloads", () => {
  function read(path: string, _encoding?: "utf-8"): string {
    if (path === "fail") {
      throw new Error("io");
    }
    return "data";
  }

  it("preserves callable signature with optional args", () => {
    const safeRead = trySync(read, (e) => String(e));
    expect(safeRead("ok")._tag).toBe("Ok");
    expect(safeRead("fail")._tag).toBe("Err");
    expect(safeRead("ok", "utf-8")._tag).toBe("Ok");
  });
});
