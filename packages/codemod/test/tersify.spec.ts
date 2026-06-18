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

    it("wraps an object literal returned with an `as` cast in parentheses", () => {
      const src = "const make = (x) => { return { val: x } as Foo; };";
      const expected = "const make = (x) => ({ val: x } as Foo);";
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
  });

  describe("boolean return simplifications", () => {
    it("converts if-else returning booleans to a simple condition return", () => {
      const src = `
function isPositive(x: number) {
  if (x > 0) {
    return true;
  } else {
    return false;
  }
}
      `.trim();
      const expected = "const isPositive = (x: number) => x > 0;";
      expect(tersify(src)).toBe(expected);
    });

    it("converts if-else returning inverted booleans to a negated condition return", () => {
      const src = `
function isNegative(x: number) {
  if (x >= 0) {
    return false;
  } else {
    return true;
  }
}
      `.trim();
      const expected = "const isNegative = (x: number) => !(x >= 0);";
      expect(tersify(src)).toBe(expected);
    });
  });

  describe("identity filter shorthand", () => {
    it("converts x => x inside filter to Boolean", () => {
      const src = "const active = users.filter(x => x);";
      const expected = "const active = users.filter(Boolean);";
      expect(tersify(src)).toBe(expected);
    });

    it("converts x => !!x inside filter to Boolean", () => {
      const src = "const active = users.filter(x => !!x);";
      const expected = "const active = users.filter(Boolean);";
      expect(tersify(src)).toBe(expected);
    });

    it("does not convert identity callback inside map to Boolean", () => {
      const src = "const active = users.map(x => x);";
      expect(tersify(src)).toBe(src);
    });
  });

  describe("optional chaining from guard clauses", () => {
    it("converts a guard clause returning undefined into an optional chain", () => {
      const src = `
function getName(user: any) {
  if (!user) {
    return;
  }
  return user.name;
}
      `.trim();
      const expected = "const getName = (user: any) => user?.name;";
      expect(tersify(src)).toBe(expected);
    });

    it("works with simple negated property accesses in guard clauses", () => {
      const src = `
function getCity(user: any) {
  if (!user.address) {
    return;
  }
  return user.address.city;
}
      `.trim();
      const expected = "const getCity = (user: any) => user.address?.city;";
      expect(tersify(src)).toBe(expected);
    });
  });

  describe("prevent nesting ternaries (no matroskas)", () => {
    it("does not convert sequential if/return chains into nested ternaries", () => {
      const src = `
function resolveValue(next: any) {
  if (next instanceof CompatResultAsync) return next.toCore();
  if (next instanceof CoreResultAsync) return next;
  if (next instanceof CompatResult) return next.inner;
  return next;
}
      `.trim();
      expect(tersify(src)).toBe(src);
    });

    it("does not convert if-else statements containing conditional expressions", () => {
      const src = `
function test(cond: boolean, a: any) {
  if (cond) {
    return a ? 1 : 2;
  } else {
    return 3;
  }
}
      `.trim();
      expect(tersify(src)).toBe(src);
    });
  });

  describe("sequential if statements to switch", () => {
    it("converts a sequence of 3 or more if statements comparing the same variable to a switch", () => {
      const src = `
function handle(name: string, node: any) {
  if (name === "sequenceTupleAsync") {
    return some(edit(\`ResultAsync.combineTuple(\${argsToText(node.arguments)})\`, ["ResultAsync"]));
  }
  if (name === "getOrElse") {
    return some(edit(\`unwrapOr(\${argsToText(node.arguments)})\`, ["unwrapOr"]));
  }
  if (name === "collect") {
    return some(edit(\`combine(\${argsToText(node.arguments)})\`, ["combine"]));
  }
  if (name === "matchResult" || name === "matchMaybe") {
    return some(edit(\`match(\${argsToText(node.arguments)})\`, ["match"]));
  }
  if (name === "fold") {
    return map(foldHandlerTexts(node.arguments[0]), ({ okText, errText }) =>
      edit(\`match(\${okText}, \${errText})\`, ["match"]),
    );
  }
}
      `.trim();
      const expected = `
function handle(name: string, node: any) {
  switch (name) {
    case "sequenceTupleAsync":
      return some(edit(\`ResultAsync.combineTuple(\${argsToText(node.arguments)})\`, ["ResultAsync"]));
    case "getOrElse":
      return some(edit(\`unwrapOr(\${argsToText(node.arguments)})\`, ["unwrapOr"]));
    case "collect":
      return some(edit(\`combine(\${argsToText(node.arguments)})\`, ["combine"]));
    case "matchResult":
    case "matchMaybe":
      return some(edit(\`match(\${argsToText(node.arguments)})\`, ["match"]));
    case "fold":
      return map(foldHandlerTexts(node.arguments[0]), ({ okText, errText }) =>
        edit(\`match(\${okText}, \${errText})\`, ["match"]),
      );
  }
}
      `.trim();
      expect(tersify(src)).toBe(expected);
    });
  });

  // Regression: issues #37 / #38 — JSX files must be parsed in TSX mode, else
  // `<`/`>` read as comparison operators truncate node boundaries and edits
  // relocate a statement terminator into the JSX opening tag.
  describe("jsx (tsx-mode parsing)", () => {
    it("collapses an if-guard before a JSX return without corrupting the tag", () => {
      const src = [
        "function FieldError({ content }: { content: string | null }) {",
        "  if (!content) {",
        "    return null;",
        "  }",
        '  return <div role="alert">{content}</div>;',
        "}",
      ].join("\n");
      const out = tersify(src, true);
      // The bug injected `role="alert";` into the opening tag.
      expect(out).not.toContain('role="alert";');
      expect(out).toContain('<div role="alert">{content}</div>');
    });

    it("preserves a `.ts` angle-bracket cast (not parsed as TSX)", () => {
      const src = "function head<T>(xs: T[]): T {\n  return <T>xs[0];\n}";
      // jsx=false: `<T>xs[0]` is a valid cast and must survive.
      expect(tersify(src, false)).toBe("const head = <T,>(xs: T[]): T => <T>xs[0];");
    });
  });
});
