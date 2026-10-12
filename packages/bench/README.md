# `@onrails/bench`

Private microbenchmarks: `@onrails/result` vs `neverthrow`, `@onrails/pattern` vs `ts-pattern`.

Not published. Numbers are evidence for docs — never a CI fail gate against rivals.

## Run

```bash
# build published surfaces first (bench imports dist/)
bun run build

# runtime + bundle → packages/bench/results/*.json (gitignored)
bun run bench

# also regenerate committed RESULTS.md
bun run bench:md

# soft CI smoke (same suites, quiet mitata, throw on harness errors)
bun run bench -- --ci

# filters
bun run bench -- --runtime
bun run bench -- --bundle
```

## Fairness

- Same fixtures, same terminal sink (`do_not_optimize` / `blackbox`).
- Overlapping APIs only.
  - **Result headline:** core carriers (prototype methods) vs neverthrow. Compat shim (`@onrails/result/compat/neverthrow`) is a **side lane** — migration cost, not the vs-neverthrow claim.
  - **Pattern:** shallow `.with` / literal / `when` / `matchTag`. No `P.select`, deep wildcards, or nested unwrap (pattern non-goals).
- Bundle metric is **minify+gzip of a fair import graph**, not whole-package size.
- Pin rival versions in this package’s `package.json`; versions are recorded in JSON / `RESULTS.md`.
- Runtime primary: Bun. Node/Deno out of v1.

## Layout

| Path | Role |
|------|------|
| `src/cases/result.ts` | Result runtime cases |
| `src/cases/pattern.ts` | Pattern runtime cases |
| `src/bundle/entries/` | Fair import-graph entrypoints |
| `src/bundle/measure.ts` | minify + gzip |
| `RESULTS.md` | Committed snapshot (regenerate with `bench:md`) |
| `results/*.json` | Local raw output (gitignored) |
