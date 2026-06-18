import { describe, expect, it } from "bun:test";
import { tersify } from "../src/tersify.js";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: test suite contains many test cases
describe("tersify", () => {
  describe("implicit arrow returns", () => {
    it("converts arrow function with block body containing a single return", () => {
      const src = "const add = (a, b) => { return a + b; };";
      const expected = "const add = (a, b) => a + b;";
      expect(tersify(src)).toBe(expected);
    });

    it("wraps returned object literals in parentheses", () => {
      const src = "const makeObj = (x) => { return { val: x }; };";
      const expected = "const makeObj = (x) => ({ val: x });";
      expect(tersify(src)).toBe(expected);
    });

    it("does not change arrow functions with multiple statements", () => {
      const src = "const add = (a, b) => { const sum = a + b; return sum; };";
      expect(tersify(src)).toBe(src);
    });
  });

  describe("function expressions", () => {
    it("converts simple anonymous function expressions to implicit return arrow functions", () => {
      const src = "const add = function(a, b) { return a + b; };";
      const expected = "const add = (a, b) => a + b;";
      expect(tersify(src)).toBe(expected);
    });

    it("preserves async modifier on function expressions", () => {
      const src = "const fetchVal = async function() { return 42; };";
      const expected = "const fetchVal = async () => 42;";
      expect(tersify(src)).toBe(expected);
    });

    it("preserves type parameters and handles JSX safety by adding trailing comma for single type param", () => {
      const src = "const identity = function<T>(x: T): T { return x; };";
      const expected = "const identity = <T,>(x: T): T => x;";
      expect(tersify(src)).toBe(expected);
    });

    it("handles multiple type parameters without adding a trailing comma", () => {
      const src = "const pair = function<T, U>(x: T, y: U) { return [x, y]; };";
      const expected = "const pair = <T, U>(x: T, y: U) => [x, y];";
      expect(tersify(src)).toBe(expected);
    });

    it("bails out if the function expression uses 'this' or 'arguments'", () => {
      const srcThis = "const f = function() { return this.x; };";
      expect(tersify(srcThis)).toBe(srcThis);

      const srcArgs = "const f = function() { return arguments[0]; };";
      expect(tersify(srcArgs)).toBe(srcArgs);
    });

    it("does not bail out if 'this' or 'arguments' is used inside a nested function context", () => {
      const src = "const f = function() { return function() { return this.x; }; };";
      const expected = "const f = () => function() { return this.x; };";
      expect(tersify(src)).toBe(expected);
    });
  });

  describe("function declarations", () => {
    it("converts a standard function declaration to a const arrow function", () => {
      const src = "function add(a, b) { return a + b; }";
      const expected = "const add = (a, b) => a + b;";
      expect(tersify(src)).toBe(expected);
    });

    it("preserves export modifier", () => {
      const src = "export function add(a, b) { return a + b; }";
      const expected = "export const add = (a, b) => a + b;";
      expect(tersify(src)).toBe(expected);
    });

    it("bails out for default exported functions to avoid invalid export default const syntax", () => {
      const src = "export default function add(a, b) { return a + b; }";
      expect(tersify(src)).toBe(src);
    });

    it("bails out if the function is referenced before its declaration to avoid TDZ issues", () => {
      const src = "const val = add(1, 2);\nfunction add(a, b) { return a + b; }";
      expect(tersify(src)).toBe(src);
    });

    it("converts when name references only occur after or within the function (valid TDZ)", () => {
      const src = "function add(a, b) { return a + b; }\nconst val = add(1, 2);";
      const expected = "const add = (a, b) => a + b;\nconst val = add(1, 2);";
      expect(tersify(src)).toBe(expected);
    });
  });

  describe("if/return structures to ternaries", () => {
    it("converts if-else returning structures directly to a ternary return", () => {
      const src = `
function getSign(x: number) {
  if (x > 0) {
    return "positive";
  } else {
    return "negative";
  }
}
      `.trim();
      const expected = `
const getSign = (x: number) => x > 0 ? "positive" : "negative";
      `.trim();
      expect(tersify(src)).toBe(expected);
    });

    it("converts if followed immediately by return to a ternary return", () => {
      const src = `
function getSign(x: number) {
  if (x > 0) {
    return "positive";
  }
  return "negative";
}
      `.trim();
      const expected = `
const getSign = (x: number) => x > 0 ? "positive" : "negative";
      `.trim();
      expect(tersify(src)).toBe(expected);
    });

    it("works with statement bodies that are not blocks", () => {
      const src = `
function getSign(x: number) {
  if (x > 0) return "positive";
  return "negative";
}
      `.trim();
      const expected = `
const getSign = (x: number) => x > 0 ? "positive" : "negative";
      `.trim();
      expect(tersify(src)).toBe(expected);
    });

    it("preserves statements before the if statement", () => {
      const src = `
function process(x: number) {
  const y = x * 2;
  if (y > 10) {
    return "large";
  }
  return "small";
}
      `.trim();
      const expected = `
function process(x: number) {
  const y = x * 2;
  return y > 10 ? "large" : "small";
}
      `.trim();
      expect(tersify(src)).toBe(expected);
    });

    it("does not change if the return statement does not have an expression", () => {
      const src = `
function test(condition: boolean) {
  if (condition) {
    return;
  }
  return 42;
}
      `.trim();
      expect(tersify(src)).toBe(src);
    });
  });

  describe("complex real-world integration scenarios", () => {
    it("handles a complex combination of nested functions, objects, classes, and ternary refactoring", () => {
      const src = `
export function createFormatter(options: { debug: boolean }) {
  return function(value: number) {
    if (value === 0) {
      return { formatted: "zero", raw: 0 };
    }
    const sign = value > 0 ? "+" : "-";
    if (options.debug) {
      return {
        formatted: sign + Math.abs(value).toString(),
        raw: value,
      };
    }
    return {
      formatted: Math.abs(value).toString(),
      raw: value,
    };
  };
}

class Handler {
  private count = 0;
  increment() {
    return this.count++;
  }
}

const processor = {
  process(data: any) {
    return data;
  },
};

const processList = (list: number[]) => {
  return list.map((x) => {
    return x * 2;
  });
};

function fib(n: number): number {
  if (n <= 1) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

const res = compute(5);
function compute(n: number) {
  return n * 10;
}
      `.trim();

      const expected = `
export const createFormatter = (options: { debug: boolean }) => function(value: number) {
    if (value === 0) {
      return { formatted: "zero", raw: 0 };
    }
    const sign = value > 0 ? "+" : "-";
    return options.debug ? {
        formatted: sign + Math.abs(value).toString(),
        raw: value,
      } : {
      formatted: Math.abs(value).toString(),
      raw: value,
    };
  };

class Handler {
  private count = 0;
  increment() {
    return this.count++;
  }
}

const processor = {
  process(data: any) {
    return data;
  },
};

const processList = (list: number[]) => list.map((x) => x * 2);

const fib = (n: number): number => n <= 1 ? n : fib(n - 1) + fib(n - 2);

const res = compute(5);
function compute(n: number) {
  return n * 10;
}
      `.trim();

      expect(tersify(src)).toBe(expected);
    });
  });
});
