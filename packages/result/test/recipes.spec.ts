/**
 * Runtime + type assertions for the point-free recipes in RECIPES.md
 * (sections 9–11). Each describe block mirrors one recipe; stubs are
 * inlined so the test file is self-contained.
 */
import { describe, expect, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { flow } from "../src/pipe.js";
import { err, flatMap, isErr, isOk, map, ok, type Result, recover } from "../src/result.js";

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 9 — Pure error unification
// ─────────────────────────────────────────────────────────────────────────────

type Body = { byteLength: number };
type NetworkError = { kind: "network"; retryable: boolean };
type Fatal = { kind: "fatal"; message: string };

const emptyBody: Body = { byteLength: 0 };

const makeFetch =
  (outcome: Result<Body, NetworkError | Fatal>) =>
  (_url: string): Result<Body, NetworkError | Fatal> =>
    outcome;

describe("recipe 9 — pure error unification", () => {
  const successBody: Body = { byteLength: 42 };

  it("threads success through unchanged", () => {
    const fetchOrEmpty = flow(
      makeFetch(ok(successBody)),
      recover((e: NetworkError | Fatal) => (e.kind === "fatal" ? err(e) : ok(emptyBody))),
    );
    expect(fetchOrEmpty("https://x")).toEqual(ok(successBody));
  });

  it("absorbs network errors into the Ok track via fallback", () => {
    const fetchOrEmpty = flow(
      makeFetch(err({ kind: "network", retryable: true })),
      recover((e: NetworkError | Fatal) => (e.kind === "fatal" ? err(e) : ok(emptyBody))),
    );
    expect(fetchOrEmpty("https://x")).toEqual(ok(emptyBody));
  });

  it("bubbles fatal errors unchanged", () => {
    const fatal: Fatal = { kind: "fatal", message: "boom" };
    const fetchOrEmpty = flow(
      makeFetch(err(fatal)),
      recover((e: NetworkError | Fatal) => (e.kind === "fatal" ? err(e) : ok(emptyBody))),
    );
    expect(fetchOrEmpty("https://x")).toEqual(err(fatal));
  });

  it("narrows the inferred error type to Fatal only", () => {
    const fetchOrEmpty = flow(
      makeFetch(ok(emptyBody)),
      recover(
        (e: NetworkError | Fatal): Result<Body, Fatal> =>
          e.kind === "fatal" ? err(e) : ok(emptyBody),
      ),
    );
    type Out = ReturnType<typeof fetchOrEmpty>;
    expectType<TypeEqual<Out, Result<Body, Fatal>>>(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 10 — Strategy-parametrised flows (closure ladder)
// ─────────────────────────────────────────────────────────────────────────────

type FetchError = { kind: "network" } | { kind: "fatal"; message: string };

const fetchStub =
  (outcome: Result<Body, FetchError>) =>
  (_url: string): Result<Body, FetchError> =>
    outcome;

const fetchWith = (
  cfg: { fallback?: Body; rethrow: (e: FetchError) => boolean },
  src: (url: string) => Result<Body, FetchError>,
) =>
  flow(
    src,
    recover(
      (e: FetchError): Result<Body, FetchError> =>
        cfg.rethrow(e) || !cfg.fallback ? err(e) : ok(cfg.fallback),
    ),
    map((body: Body) => body.byteLength),
  );

describe("recipe 10 — strategy-parametrised flow", () => {
  const networkErr: FetchError = { kind: "network" };
  const fatalErr: FetchError = { kind: "fatal", message: "boom" };

  it("two strategies behave differently on the same input", () => {
    const networkFails = fetchStub(err(networkErr));
    const lenient = fetchWith(
      { fallback: emptyBody, rethrow: (e) => e.kind === "fatal" },
      networkFails,
    );
    const strict = fetchWith({ rethrow: () => true }, networkFails);

    expect(lenient("https://x")).toEqual(ok(0));
    expect(strict("https://x")).toEqual(err(networkErr));
  });

  it("strategy without fallback always rethrows", () => {
    const noFallback = fetchWith(
      { rethrow: (e) => e.kind === "network" },
      fetchStub(err(networkErr)),
    );
    expect(noFallback("https://x")).toEqual(err(networkErr));
  });

  it("strategy with fallback recovers when rethrow predicate is false", () => {
    const recoverNetwork = fetchWith(
      { fallback: { byteLength: 7 }, rethrow: (e) => e.kind === "fatal" },
      fetchStub(err(networkErr)),
    );
    expect(recoverNetwork("https://x")).toEqual(ok(7));

    const stillRethrowsFatal = fetchWith(
      { fallback: { byteLength: 7 }, rethrow: (e) => e.kind === "fatal" },
      fetchStub(err(fatalErr)),
    );
    expect(stillRethrowsFatal("https://x")).toEqual(err(fatalErr));
  });

  it("HOF returns a (url: string) => Result<number, FetchError>", () => {
    const built = fetchWith(
      { fallback: emptyBody, rethrow: () => false },
      fetchStub(ok(emptyBody)),
    );
    type Built = typeof built;
    expectType<TypeEqual<Built, (url: string) => Result<number, FetchError>>>(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 11 — Composing flows
// ─────────────────────────────────────────────────────────────────────────────

type Validated = { tag: "validated"; value: string };
type Enriched = Validated & { ts: number };
type Saved = { id: string; at: number };

type ParseError = { kind: "parse"; message: string };
type SchemaError = { kind: "schema"; field: string };
type DbError = { kind: "db"; cause: unknown };

const parseJson = (raw: string): Result<unknown, ParseError> => {
  try {
    return ok(JSON.parse(raw));
  } catch (e) {
    return err({ kind: "parse", message: String(e) });
  }
};

const validateSchema = (x: unknown): Result<Validated, SchemaError> => {
  if (typeof x === "object" && x !== null && "value" in x && typeof x.value === "string") {
    return ok({ tag: "validated", value: x.value });
  }
  return err({ kind: "schema", field: "value" });
};

const addTimestamp = (v: Validated): Enriched => ({ ...v, ts: 1_700_000_000 });

const persistStub =
  (outcome: Result<Saved, DbError>) =>
  (_v: Enriched): Result<Saved, DbError> =>
    outcome;

describe("recipe 11 — composing flows", () => {
  const happySaved: Saved = { id: "1", at: 1_700_000_000 };

  const parseAndValidate = flow(parseJson, flatMap(validateSchema));

  it("short-circuits on the first failure (parse)", () => {
    const enrichAndPersist = flow(addTimestamp, persistStub(ok(happySaved)));
    const ingest = flow(parseAndValidate, flatMap(enrichAndPersist));

    const result = ingest("not json");
    expect(isErr(result) && result.error.kind).toBe("parse");
  });

  it("short-circuits on schema failure", () => {
    const enrichAndPersist = flow(addTimestamp, persistStub(ok(happySaved)));
    const ingest = flow(parseAndValidate, flatMap(enrichAndPersist));

    const result = ingest('{"wrong":"shape"}');
    expect(isErr(result) && result.error.kind).toBe("schema");
  });

  it("short-circuits on db failure after validation succeeds", () => {
    const dbDown: DbError = { kind: "db", cause: "connection refused" };
    const enrichAndPersist = flow(addTimestamp, persistStub(err(dbDown)));
    const ingest = flow(parseAndValidate, flatMap(enrichAndPersist));

    const result = ingest('{"value":"hi"}');
    expect(isErr(result) && result.error).toEqual(dbDown);
  });

  it("threads through every step on the happy path", () => {
    const enrichAndPersist = flow(addTimestamp, persistStub(ok(happySaved)));
    const ingest = flow(parseAndValidate, flatMap(enrichAndPersist));

    const result = ingest('{"value":"hi"}');
    expect(isOk(result) && result.value).toEqual(happySaved);
  });

  it("preserves the full error union in the inferred type", () => {
    const enrichAndPersist = flow(addTimestamp, persistStub(ok(happySaved)));
    const ingest = flow(parseAndValidate, flatMap(enrichAndPersist));

    type Ingest = typeof ingest;
    expectType<
      TypeEqual<Ingest, (raw: string) => Result<Saved, ParseError | SchemaError | DbError>>
    >(true);
  });
});
