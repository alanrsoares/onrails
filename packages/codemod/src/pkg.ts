import { relative } from "node:path";
import { type Maybe, match, none, some } from "@onrails/maybe";
import { type Result, ResultAsync, trySync } from "@onrails/result";
import { DEP_KEYS } from "./constants.js";
import { readFileText, toError, writeFileText } from "./io.js";
import type { ComputedPkg, PkgChange, PkgUpdate } from "./types.js";

const reorderDeps = (deps: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));

export const parsePackageJson = (raw: string): Result<Record<string, unknown>, Error> =>
  trySync(() => JSON.parse(raw) as Record<string, unknown>, toError)();

const applyDepRewrite =
  (fileSpec: string) =>
  (acc: PkgUpdate, key: string): PkgUpdate => {
    const deps = acc.json[key] as Record<string, string> | undefined;
    if (!deps || typeof deps !== "object" || !("neverthrow" in deps)) return acc;
    const { neverthrow: _drop, ...rest } = deps;
    return {
      json: { ...acc.json, [key]: reorderDeps({ ...rest, "@onrails/result": fileSpec }) },
      removed: [...acc.removed, key],
    };
  };

export const computePkgRewrite = (
  json: Record<string, unknown>,
  path: string,
  onrailsAbs: string,
): Maybe<ComputedPkg> => {
  const fileSpec = `file:${relative(path.replace(/\/package\.json$/, ""), onrailsAbs)}`;
  const updated = DEP_KEYS.reduce(applyDepRewrite(fileSpec), { json, removed: [] } as PkgUpdate);
  return updated.removed.length === 0
    ? none()
    : some({ json: updated.json, removed: updated.removed, fileSpec });
};

const toPkgChange = (path: string, c: ComputedPkg): PkgChange => ({
  path,
  removed: [...c.removed],
  addedAs: c.fileSpec,
});

export const rewritePkg = (
  path: string,
  onrailsAbs: string,
  dry: boolean,
): ResultAsync<Maybe<PkgChange>, Error> =>
  readFileText(path)
    .flatMap((raw) => ResultAsync.fromResult(parsePackageJson(raw)))
    .flatMap((json) =>
      match(
        computePkgRewrite(json, path, onrailsAbs),
        (c) => {
          const change = toPkgChange(path, c);
          return dry
            ? ResultAsync.ok<Maybe<PkgChange>, Error>(some(change))
            : writeFileText(path, `${JSON.stringify(c.json, null, 2)}\n`).map(() => some(change));
        },
        () => ResultAsync.ok<Maybe<PkgChange>, Error>(none()),
      ),
    );
