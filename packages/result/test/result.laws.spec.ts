import { ResultAsync } from "../src/async.js";
import { flatMap, map, mapErr, ok } from "../src/result.js";
import type { Result } from "../src/types.js";
import { arbErrFn, arbFn, arbResult } from "./helpers/arbitraries.js";
import { type LawsAdapter, monadLaws, serializationLaws } from "./helpers/laws.js";

const fns = { arbFn, arbErrFn };

const syncAdapter: LawsAdapter<Result<number, string>> = {
  label: "Result",
  arb: arbResult,
  of: (n) => ok<number, string>(n),
  map: (r, fn) => map(r, fn),
  flatMap: (r, fn) => flatMap(r, fn),
  mapErr: (r, fn) => mapErr(r, fn),
  settle: (r) => r,
};

const asyncAdapter: LawsAdapter<ResultAsync<number, string>> = {
  label: "ResultAsync",
  arb: arbResult.map((r) => ResultAsync.fromResult(r)),
  of: (n) => ResultAsync.of<number, string>(n),
  map: (c, fn) => c.map(fn),
  flatMap: (c, fn) => c.flatMap(fn),
  mapErr: (c, fn) => c.mapErr(fn),
  settle: (c) => c,
};

monadLaws(syncAdapter, fns);
monadLaws(asyncAdapter, fns);
serializationLaws(syncAdapter);
serializationLaws(asyncAdapter);
