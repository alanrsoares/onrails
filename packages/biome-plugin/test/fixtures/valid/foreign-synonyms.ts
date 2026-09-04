// No @onrails module source in this file — same-named calls from other
// libraries must not be flagged (import-scoped divergence).
import { of } from "rxjs";

declare const r: { chain(fn: (v: unknown) => unknown): unknown; isOk(): boolean };
declare const fold: (fn: unknown) => unknown;

export const a = r.chain(() => {});
export const b = of(1);
export const c = fold(() => {});
export const d = r.isOk();
