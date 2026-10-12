import { flatMap, type Maybe, map, of } from "../src/maybe.js";
import { arbFn, arbMaybe } from "./helpers/arbitraries.js";
import { type LawsAdapter, monadLaws } from "./helpers/laws.js";

const adapter: LawsAdapter<Maybe<number>> = {
  label: "Maybe",
  arb: arbMaybe,
  of: (n) => of(n),
  map: (m, fn) => map(m, fn),
  flatMap: (m, fn) => flatMap(m, fn),
  settle: (m) => m,
};

monadLaws(adapter, arbFn);
