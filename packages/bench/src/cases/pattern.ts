import { match, when } from "@onrails/pattern";
import { matchTag } from "@onrails/pattern/tag";
import { bench, group } from "mitata";
import { P, match as tspMatch } from "ts-pattern";
import { blackbox } from "../harness.js";

type Four =
  | { readonly type: "a"; readonly n: number }
  | { readonly type: "b"; readonly n: number }
  | { readonly type: "c"; readonly n: number }
  | { readonly type: "d"; readonly n: number };

type Eight =
  | Four
  | { readonly type: "e"; readonly n: number }
  | { readonly type: "f"; readonly n: number }
  | { readonly type: "g"; readonly n: number }
  | { readonly type: "h"; readonly n: number };

type Tagged =
  | { readonly _tag: "Ok"; readonly value: number }
  | { readonly _tag: "Err"; readonly error: string };

const fourFirst: Four = { type: "a", n: 1 };
const fourMid: Four = { type: "c", n: 1 };
const fourLast: Four = { type: "d", n: 1 };
const eightLast: Eight = { type: "h", n: 1 };

const foldFourOnrails = (v: Four): number =>
  match(v)
    .with({ type: "a" }, (x) => x.n + 1)
    .with({ type: "b" }, (x) => x.n + 2)
    .with({ type: "c" }, (x) => x.n + 3)
    .with({ type: "d" }, (x) => x.n + 4)
    .exhaustive();

const foldFourTsp = (v: Four): number =>
  tspMatch(v)
    .with({ type: "a" }, (x) => x.n + 1)
    .with({ type: "b" }, (x) => x.n + 2)
    .with({ type: "c" }, (x) => x.n + 3)
    .with({ type: "d" }, (x) => x.n + 4)
    .exhaustive();

const foldEightOnrails = (v: Eight): number =>
  match(v)
    .with({ type: "a" }, (x) => x.n)
    .with({ type: "b" }, (x) => x.n)
    .with({ type: "c" }, (x) => x.n)
    .with({ type: "d" }, (x) => x.n)
    .with({ type: "e" }, (x) => x.n)
    .with({ type: "f" }, (x) => x.n)
    .with({ type: "g" }, (x) => x.n)
    .with({ type: "h" }, (x) => x.n)
    .exhaustive();

const foldEightTsp = (v: Eight): number =>
  tspMatch(v)
    .with({ type: "a" }, (x) => x.n)
    .with({ type: "b" }, (x) => x.n)
    .with({ type: "c" }, (x) => x.n)
    .with({ type: "d" }, (x) => x.n)
    .with({ type: "e" }, (x) => x.n)
    .with({ type: "f" }, (x) => x.n)
    .with({ type: "g" }, (x) => x.n)
    .with({ type: "h" }, (x) => x.n)
    .exhaustive();

const foldFourOnrailsHoisted = match<Four>()
  .with({ type: "a" }, (x) => x.n + 1)
  .with({ type: "b" }, (x) => x.n + 2)
  .with({ type: "c" }, (x) => x.n + 3)
  .with({ type: "d" }, (x) => x.n + 4)
  .exhaustive();

const registerDisc = (): void => {
  group("pattern-disc", () => {
    bench("pattern.disc4.first", () => blackbox(foldFourOnrails(fourFirst)));
    bench("tsp.disc4.first", () => blackbox(foldFourTsp(fourFirst)));
    bench("pattern.disc4.first.hoisted", () => blackbox(foldFourOnrailsHoisted(fourFirst)));
    bench("pattern.disc4.mid", () => blackbox(foldFourOnrails(fourMid)));
    bench("tsp.disc4.mid", () => blackbox(foldFourTsp(fourMid)));
    bench("pattern.disc4.mid.hoisted", () => blackbox(foldFourOnrailsHoisted(fourMid)));
    bench("pattern.disc4.last", () => blackbox(foldFourOnrails(fourLast)));
    bench("tsp.disc4.last", () => blackbox(foldFourTsp(fourLast)));
    bench("pattern.disc4.last.hoisted", () => blackbox(foldFourOnrailsHoisted(fourLast)));
    bench("pattern.disc8.last", () => blackbox(foldEightOnrails(eightLast)));
    bench("tsp.disc8.last", () => blackbox(foldEightTsp(eightLast)));
  });
};

type Lit = "idle" | "running" | "done";

const foldLitOnrails = (s: Lit): number =>
  match(s)
    .with("idle", () => 0)
    .with("running", () => 1)
    .with("done", () => 2)
    .exhaustive();

const foldLitTsp = (s: Lit): number =>
  tspMatch(s)
    .with("idle", () => 0)
    .with("running", () => 1)
    .with("done", () => 2)
    .exhaustive();

const foldLitOnrailsHoisted = match<Lit>()
  .with("idle", () => 0)
  .with("running", () => 1)
  .with("done", () => 2)
  .exhaustive();

const lit: Lit = "running";

const registerLiteral = (): void => {
  group("pattern-literal", () => {
    bench("pattern.literal", () => blackbox(foldLitOnrails(lit)));
    bench("tsp.literal", () => blackbox(foldLitTsp(lit)));
    bench("pattern.literal.hoisted", () => blackbox(foldLitOnrailsHoisted(lit)));
  });
};

const isPositive = (x: number): x is number => x > 10;
const n = 42;

const registerWhen = (): void => {
  group("pattern-when", () => {
    bench("pattern.when", () =>
      blackbox(
        match(n)
          .with(when(isPositive), (x) => x * 2)
          .otherwise(() => 0),
      ),
    );
    bench("tsp.when", () =>
      blackbox(
        tspMatch(n)
          .with(P.when(isPositive), (x) => x * 2)
          .otherwise(() => 0),
      ),
    );
  });
};

const foldTagOnrails = (t: Tagged): number =>
  matchTag(t, {
    Ok: (v) => v.value + 1,
    Err: (e) => e.error.length,
  });

const foldTagTsp = (t: Tagged): number =>
  tspMatch(t)
    .with({ _tag: "Ok" }, (v) => v.value + 1)
    .with({ _tag: "Err" }, (e) => e.error.length)
    .exhaustive();

const taggedOk: Tagged = { _tag: "Ok", value: 7 };
const taggedErr: Tagged = { _tag: "Err", error: "x" };

const registerMatchTag = (): void => {
  group("pattern-matchTag", () => {
    bench("pattern.matchTag.ok", () => blackbox(foldTagOnrails(taggedOk)));
    bench("tsp.matchTag.ok", () => blackbox(foldTagTsp(taggedOk)));
    bench("pattern.matchTag.err", () => blackbox(foldTagOnrails(taggedErr)));
    bench("tsp.matchTag.err", () => blackbox(foldTagTsp(taggedErr)));
  });
};

/** Register Pattern runtime benches vs ts-pattern (overlapping surface only). */
export const registerPatternBenches = (): void => {
  registerDisc();
  registerLiteral();
  registerWhen();
  registerMatchTag();
};
