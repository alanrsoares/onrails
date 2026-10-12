import { combine, err, flatMap, map, match, ok } from "@onrails/result";

export const sample = match(
  flatMap(
    map(ok(1), (n) => n + 1),
    (n) => (n > 0 ? ok(n) : err("neg")),
  ),
  (n) => n,
  (e) => e.length,
);

export const combined = combine([ok(1), ok(2), ok(3), ok(4)]);
