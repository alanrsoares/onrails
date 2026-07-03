/**
 * Cross-engine conformance for the boundary idioms owned by
 * `src/boundary-spec.ts`.
 *
 * The ESLint plugin (plain JS) and Biome plugin (GritQL) cannot import the
 * spec — cross-package imports are forbidden — so they hand-copy the names.
 * This test reads those artifacts off disk (test-time file reads, not package
 * imports) and asserts every spec name appears in each engine. Deliberate
 * differences must be declared in `ENGINE_DIVERGENCES` or they are drift.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEPRECATED_SYNONYMS,
  ENGINE_DIVERGENCES,
  NO_DEPRECATED_SYNONYMS_RULE,
  NO_PROMISE_RESULT_RULE,
  NO_UNSAFE_UNWRAP_RULE,
  UNSAFE_UNWRAP_MEMBER_RENAMES,
  UNSAFE_UNWRAP_NAMES,
} from "../src/boundary-spec.js";
import { UNSAFE_UNWRAP_METHODS } from "../src/constants.js";

const read = (rel: string) => readFileSync(join(import.meta.dir, rel), "utf8");

const eslintSource = read("../../eslint-plugin/src/index.js");
const gritUnsafeUnwrap = read("../../biome-plugin/rules/no-unsafe-unwrap.grit");
const gritDeprecatedSynonyms = read("../../biome-plugin/rules/no-deprecated-synonyms.grit");
const gritPromiseResult = read("../../biome-plugin/rules/no-promise-result.grit");
const biomePkg = JSON.parse(read("../../biome-plugin/package.json")) as {
  exports: Record<string, string>;
};

/** Whole-identifier presence — avoids `unwrap` matching inside `unwrapOk`. */
const hasIdentifier = (source: string, name: string): boolean =>
  new RegExp(String.raw`\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`).test(source);

describe("no-unsafe-unwrap conformance", () => {
  const rows = [...UNSAFE_UNWRAP_NAMES].map((name) => ({ label: name, name }));

  it.each(rows)("eslint flags $label", ({ name }) => {
    expect(eslintSource).toContain(`"${name}"`);
  });

  it.each(rows)("biome flags $label", ({ name }) => {
    expect(hasIdentifier(gritUnsafeUnwrap, name)).toBe(true);
  });

  it("both engines carry the shared rule message verbatim", () => {
    expect(eslintSource).toContain(NO_UNSAFE_UNWRAP_RULE.message);
    expect(gritUnsafeUnwrap).toContain(NO_UNSAFE_UNWRAP_RULE.message);
  });
});

describe("no-deprecated-synonyms conformance", () => {
  const rows = DEPRECATED_SYNONYMS.map((synonym) => ({ label: synonym.name, synonym }));

  it.each(rows)("eslint flags $label", ({ synonym }) => {
    expect(eslintSource).toContain(`"${synonym.name}"`);
  });

  it.each(rows)("eslint suggests the canonical name for $label", ({ synonym }) => {
    expect(eslintSource).toContain(`"${synonym.canonical}"`);
  });

  it.each(rows)("biome flags $label", ({ synonym }) => {
    expect(hasIdentifier(gritDeprecatedSynonyms, synonym.name)).toBe(true);
  });

  it.each(rows)("biome documents the canonical name for $label", ({ synonym }) => {
    expect(hasIdentifier(gritDeprecatedSynonyms, synonym.canonical)).toBe(true);
  });

  it("eslint registers the rule id", () => {
    expect(eslintSource).toContain(`"${NO_DEPRECATED_SYNONYMS_RULE.id}"`);
  });
});

describe("no-promise-result conformance", () => {
  it("eslint registers the rule id", () => {
    expect(eslintSource).toContain(`"${NO_PROMISE_RESULT_RULE.id}"`);
  });

  it("biome rule header names the rule id", () => {
    expect(gritPromiseResult).toContain(NO_PROMISE_RESULT_RULE.id);
  });

  it("biome diagnostic carries the spec message verbatim", () => {
    expect(gritPromiseResult).toContain(NO_PROMISE_RESULT_RULE.message);
  });

  const tokens = [NO_PROMISE_RESULT_RULE.replacement, ...NO_PROMISE_RESULT_RULE.boundaryHelpers];
  it.each(tokens.map((token) => ({ label: token, token })))("eslint message names $label", ({
    token,
  }) => {
    expect(eslintSource).toContain(token);
  });
});

describe("biome-plugin packaging", () => {
  const ruleIds = [
    NO_PROMISE_RESULT_RULE.id,
    NO_UNSAFE_UNWRAP_RULE.id,
    NO_DEPRECATED_SYNONYMS_RULE.id,
  ];

  it.each(ruleIds.map((id) => ({ label: id, id })))("package.json exports ./rules/$label.grit", ({
    id,
  }) => {
    expect(biomePkg.exports[`./rules/${id}.grit`]).toBe(`./rules/${id}.grit`);
  });
});

describe("declared divergences", () => {
  it("eslint's test-file exemption on no-unsafe-unwrap is declared, not accidental", () => {
    const declared = ENGINE_DIVERGENCES.some(
      (d) =>
        d.rule === NO_UNSAFE_UNWRAP_RULE.id &&
        d.engine === "biome" &&
        d.divergence === "no-test-file-exemption",
    );
    expect(declared).toBe(true);
  });

  it("eslint implements the declared exemption", () => {
    expect(eslintSource).toContain('".spec."');
    expect(eslintSource).toContain('".test."');
  });

  it("biome cannot implement the exemption (GritQL has no file-path scoping)", () => {
    expect(gritUnsafeUnwrap.includes(".spec.")).toBe(false);
  });

  it("no undeclared divergences exist in the spec", () => {
    expect(ENGINE_DIVERGENCES).toHaveLength(1);
  });
});

describe("codemod derives from the spec", () => {
  it("constants.UNSAFE_UNWRAP_METHODS mirrors the spec rename map", () => {
    expect([...UNSAFE_UNWRAP_METHODS.entries()]).toEqual([...UNSAFE_UNWRAP_MEMBER_RENAMES]);
  });
});
