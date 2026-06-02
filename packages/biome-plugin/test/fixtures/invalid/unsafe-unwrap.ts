declare const r: { _unsafeUnwrap(): number; _unsafeUnwrapErr(): unknown };

export const a = r._unsafeUnwrap();
export const b = r._unsafeUnwrapErr();
