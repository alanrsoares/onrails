import { describe, expect, it } from "bun:test";

import * as compat from "../src/compat/neverthrow.js";
import { fluent } from "../src/fluent.js";
import * as core from "../src/result.js";

/**
 * The surface contract for the triple surface (core module-functions /
 * fluent sugar / compat shim). Each row declares where an operation is
 * expected to exist; the specs below fail when a surface drifts —
 * in either direction (missing declared op, or undeclared new op).
 */
type Row = {
  label: string;
  /** export name on the core module, or null when core deliberately lacks it */
  core: string | null;
  fluent: readonly string[];
  compatSync: readonly string[];
  compatAsync: readonly string[];
};

const TABLE: readonly Row[] = [
  {
    label: "map",
    core: "map",
    fluent: ["map"],
    compatSync: ["map"],
    compatAsync: ["map"],
  },
  {
    label: "mapErr",
    core: "mapErr",
    fluent: ["mapErr"],
    compatSync: ["mapErr"],
    compatAsync: ["mapErr"],
  },
  {
    label: "bimap",
    core: "bimap",
    fluent: ["bimap"],
    compatSync: [],
    compatAsync: [],
  },
  {
    label: "flatMap",
    core: "flatMap",
    fluent: ["flatMap", "andThen"],
    compatSync: ["andThen", "asyncAndThen"],
    compatAsync: ["flatMap", "andThen", "chain"],
  },
  {
    label: "recover",
    core: "recover",
    fluent: ["recover"],
    compatSync: ["orElse"],
    compatAsync: ["orElse"],
  },
  {
    label: "tap",
    core: "tap",
    fluent: ["tap"],
    compatSync: [],
    compatAsync: ["andTee"],
  },
  {
    label: "tapErr",
    core: "tapErr",
    fluent: ["tapErr"],
    compatSync: [],
    compatAsync: ["orTee"],
  },
  {
    label: "match",
    core: "match",
    fluent: ["match"],
    compatSync: ["match"],
    compatAsync: ["match"],
  },
  {
    label: "unwrapOr",
    core: "unwrapOr",
    fluent: ["unwrapOr"],
    compatSync: ["unwrapOr"],
    compatAsync: ["unwrapOr"],
  },
  {
    label: "isOk guard",
    core: "isOk",
    fluent: [],
    compatSync: ["isOk"],
    compatAsync: ["isOk"],
  },
  {
    label: "isErr guard",
    core: "isErr",
    fluent: [],
    compatSync: ["isErr"],
    compatAsync: ["isErr"],
  },
  // assertion tier — fluent deliberately omits these (lint-flagged outside tests)
  {
    label: "unwrapOk",
    core: "unwrapOk",
    fluent: [],
    compatSync: ["_unsafeUnwrap"],
    compatAsync: [],
  },
  {
    label: "unwrapErr",
    core: "unwrapErr",
    fluent: [],
    compatSync: ["_unsafeUnwrapErr"],
    compatAsync: [],
  },
  // terminal projection — sync surfaces are already bare values
  {
    label: "resolve",
    core: null,
    fluent: [],
    compatSync: [],
    compatAsync: ["resolve"],
  },
  // FL pure — of aliases ok on every carrier; compat mirrors neverthrow, which has no of
  {
    label: "of",
    core: "of",
    fluent: [],
    compatSync: [],
    compatAsync: [],
  },
  // debug printer — free fn on core, terminal on the fluent wrapper
  {
    label: "show",
    core: "show",
    fluent: ["toString"],
    compatSync: [],
    compatAsync: [],
  },
  // exit the fluent bracket back to plain data
  {
    label: "toResult",
    core: null,
    fluent: ["toResult"],
    compatSync: [],
    compatAsync: [],
  },
];

// compat members that exist ONLY to mirror neverthrow or bridge to core —
// intentional, not drift
const COMPAT_ONLY = {
  sync: ["value", "error"], // throwing getters, neverthrow conformance
  async: ["toCore", "then"], // core bridge + thenable protocol
} as const;

// data-carrier prop on the fluent wrapper, not an operation
const FLUENT_CARRIERS = ["result"] as const;

const protoMembers = (o: object): string[] => {
  const s = new Set<string>();
  let p = Object.getPrototypeOf(o);
  while (p && p !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(p)) if (n !== "constructor") s.add(n);
    p = Object.getPrototypeOf(p);
  }
  return [...s].sort();
};

const samples = {
  fluent: fluent(core.ok<number, string>(1)),
  compatSync: compat.ok<number, string>(1),
  compatAsync: compat.okAsync<number, string>(1),
};

describe("parity: every declared op exists on its surface", () => {
  it.each(TABLE.map((row) => [row.label, row] as const))("%s", (_label, row) => {
    if (row.core !== null) {
      expect(typeof (core as Record<string, unknown>)[row.core]).toBe("function");
    }
    for (const name of row.fluent)
      expect(typeof (samples.fluent as unknown as Record<string, unknown>)[name]).toBe("function");
    for (const name of row.compatSync)
      expect(typeof (samples.compatSync as unknown as Record<string, unknown>)[name]).not.toBe(
        "undefined",
      );
    for (const name of row.compatAsync)
      expect(typeof (samples.compatAsync as unknown as Record<string, unknown>)[name]).not.toBe(
        "undefined",
      );
  });
});

describe("parity: no undeclared members (reverse drift guard)", () => {
  const declared = (pick: (row: Row) => readonly string[]) =>
    new Set(TABLE.flatMap((row) => [...pick(row)]));

  it("fluent sync surface is fully declared", () => {
    const allowed = declared((r) => r.fluent);
    const actual = Object.keys(samples.fluent).filter(
      (k) => !FLUENT_CARRIERS.includes(k as (typeof FLUENT_CARRIERS)[number]),
    );
    expect(actual.filter((k) => !allowed.has(k)).sort()).toEqual([]);
  });

  it("compat sync surface is fully declared", () => {
    const allowed = declared((r) => r.compatSync);
    for (const m of COMPAT_ONLY.sync) allowed.add(m);
    const actual = protoMembers(samples.compatSync);
    expect(actual.filter((k) => !allowed.has(k)).sort()).toEqual([]);
  });

  it("compat async surface is fully declared", () => {
    const allowed = declared((r) => r.compatAsync);
    for (const m of COMPAT_ONLY.async) allowed.add(m);
    const actual = protoMembers(samples.compatAsync);
    expect(actual.filter((k) => !allowed.has(k)).sort()).toEqual([]);
  });
});

describe("parity: alias pairs agree on a sample (deep behaviour lives in conformance specs)", () => {
  it("fluent andThen ≡ core flatMap", () => {
    const double = (n: number) => core.ok<number, string>(n * 2);
    expect(fluent(core.ok<number, string>(3)).andThen(double).result).toEqual(
      core.flatMap(core.ok<number, string>(3), double),
    );
  });

  it("compat async chain ≡ andThen ≡ flatMap", async () => {
    const double = (n: number) => compat.okAsync<number, string>(n * 2);
    const base = () => compat.okAsync<number, string>(3);
    const viaChain = await base().chain(double).resolve();
    const viaAndThen = await base().andThen(double).resolve();
    const viaFlatMap = await base().flatMap(double).resolve();
    expect(viaChain).toEqual(viaAndThen);
    expect(viaAndThen).toEqual(viaFlatMap);
  });

  it("compat andTee/orTee observe without changing the track (tap/tapErr analog)", async () => {
    const seen: string[] = [];
    const r = await compat
      .okAsync<number, string>(1)
      .andTee((n) => {
        seen.push(`ok:${n}`);
      })
      .orTee((e) => {
        seen.push(`err:${e}`);
      })
      .resolve();
    expect(core.isOk(r) && r.value).toBe(1);
    expect(seen).toEqual(["ok:1"]);
  });

  it("compat _unsafeUnwrap ≡ core unwrapOk semantics (returns Ok value, throws on Err)", () => {
    expect(compat.ok<number, string>(7)._unsafeUnwrap()).toBe(core.unwrapOk(core.ok(7)));
    expect(() => compat.err<number, string>("boom")._unsafeUnwrap()).toThrow();
    expect(() => core.unwrapOk(core.err("boom"))).toThrow();
  });
});
