import { err, ok, Result } from "neverthrow";

export const sample = ok(1)
  .map((n) => n + 1)
  .andThen((n) => (n > 0 ? ok(n) : err("neg")))
  .match(
    (n) => n,
    (e) => e.length,
  );

export const combined = Result.combine([ok(1), ok(2), ok(3), ok(4)]);
