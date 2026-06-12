declare const r: { chain(fn: (v: unknown) => unknown): unknown; isOk(): Promise<boolean>; isErr(): Promise<boolean> };
declare const fold: (fn: unknown) => unknown;
declare const matchResult: (fn: unknown) => unknown;
declare const matchMaybe: (fn: unknown) => unknown;
declare const getOrElse: (a: unknown, b: unknown) => unknown;
declare const sequenceTupleAsync: (a: unknown) => unknown;
declare const collect: (a: unknown) => unknown;
declare const of: (a: unknown) => unknown;

export const a = r.chain(() => {});
export const b = r.isOk();
export const c = r.isErr();
export const d = fold(() => {});
export const e = matchResult(() => {});
export const f = matchMaybe(() => {});
export const g = getOrElse(null, null);
export const h = sequenceTupleAsync([]);
export const i = collect([]);
export const j = of(1);
