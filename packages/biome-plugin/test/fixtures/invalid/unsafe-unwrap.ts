declare const r: { _unsafeUnwrap(): number; _unsafeUnwrapErr(): unknown };
declare const unwrapOk: (r: unknown) => unknown;
declare const unwrapErr: (r: unknown) => unknown;
declare const unwrap: (r: unknown) => unknown;

export const a = r._unsafeUnwrap();
export const b = r._unsafeUnwrapErr();
export const c = unwrapOk(r);
export const d = unwrapErr(r);
export const e = unwrap(r);
