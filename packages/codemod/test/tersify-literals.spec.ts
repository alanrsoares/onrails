import { describe, expect, it } from "bun:test";
import { tersify } from "../src/tersify.js";

describe("tersify", () => {
  describe("object property shorthand", () => {
    it("converts property assignment to shorthand when name and initializer are identical identifiers", () => {
      const src = "const obj = { a: a, b: b, c: d };";
      const expected = "const obj = { a, b, c: d };";
      expect(tersify(src)).toBe(expected);
    });
  });

  describe("no substitution template literals", () => {
    it("converts static single-line template literals to double-quoted strings", () => {
      const src = "const url = `https://api.github.com`;";
      const expected = 'const url = "https://api.github.com";';
      expect(tersify(src)).toBe(expected);
    });

    it("does not convert template literals with substitutions", () => {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: string contains mock code
      const src = "const url = `https://${host}`;";
      expect(tersify(src)).toBe(src);
    });

    it("does not convert multi-line template literals", () => {
      const src = "const sql = `SELECT * \nFROM users`;";
      expect(tersify(src)).toBe(src);
    });

    it("drops template-only escapes for backtick and dollar", () => {
      // source: const s = `tw.div\`a\` costs \$5`;
      const src = "const s = `tw.div\\`a\\` costs \\$5`;";
      const expected = 'const s = "tw.div`a` costs $5";';
      expect(tersify(src)).toBe(expected);
    });

    it("keeps other escapes and an escaped backslash before a backtick", () => {
      // source: const s = `a\\\`b\tc`;  ->  const s = "a\\`b\tc";
      const src = "const s = `a\\\\\\`b\\tc`;";
      const expected = 'const s = "a\\\\`b\\tc";';
      expect(tersify(src)).toBe(expected);
    });
  });
});
