import { match, when } from "@onrails/pattern";
import { matchTag } from "@onrails/pattern/tag";

type Event =
  | { readonly type: "msg"; readonly text: string }
  | { readonly type: "err"; readonly code: number };

type Tagged =
  | { readonly _tag: "Ok"; readonly value: number }
  | { readonly _tag: "Err"; readonly error: string };

export const view = (e: Event) =>
  match(e)
    .with({ type: "msg" }, (x) => x.text)
    .with({ type: "err" }, (x) => String(x.code))
    .exhaustive();

const isPositive = (n: number): n is number => n > 0;

export const guarded = match(42)
  .with(when(isPositive), (n) => n)
  .otherwise(() => 0);

export const tagged = (t: Tagged) =>
  matchTag(t, {
    Ok: (v) => v.value,
    Err: (e) => e.error.length,
  });
