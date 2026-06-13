/**
 * Runtime + type assertions for the point-free recipes in RECIPES.md
 * (sections 1, 6, 9–13). Each describe block mirrors one recipe; stubs are
 * inlined so the test file is self-contained.
 */
import { describe, expect, it } from "bun:test";
import { expectType, type TypeEqual } from "ts-expect";
import { ResultAsync } from "../src/async.js";
import { flow } from "../src/pipe.js";
import {
  err,
  flatMap,
  isErr,
  isOk,
  map,
  ok,
  type Result,
  recover,
  trySync,
} from "../src/result.js";

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

type FetchConfig = {
  readonly fallback?: Body;
  readonly rethrow: (e: FetchError) => boolean;
};

const fetchStub =
  (outcome: Result<Body, FetchError>) =>
  (_url: string): Result<Body, FetchError> =>
    outcome;

const fetchWith = (cfg: FetchConfig, src: (url: string) => Result<Body, FetchError>) =>
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

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 1 — Reusable parser builder via flow
// ─────────────────────────────────────────────────────────────────────────────

const parseJsonWith = <T>(schema: { parse: (x: unknown) => T }) =>
  flow(
    trySync(JSON.parse, (e): ParseError => ({ kind: "parse", message: String(e) })),
    flatMap(trySync(schema.parse, (e): SchemaError => ({ kind: "schema", field: String(e) }))),
  );

type User = { id: string };
const UserSchema = {
  parse: (x: unknown): User => {
    if (typeof x === "object" && x !== null && "id" in x && typeof x.id === "string") {
      return { id: x.id };
    }
    throw new Error("Invalid schema");
  },
};

describe("recipe 1 — reusable parser builder", () => {
  it("successfully parses valid JSON", () => {
    const parseUser = parseJsonWith(UserSchema);
    expect(parseUser('{"id":"123"}')).toEqual(ok({ id: "123" }));
  });

  it("returns ParseError on invalid JSON syntax", () => {
    const parseUser = parseJsonWith(UserSchema);
    const result = parseUser("not-json");
    expect(isErr(result) && result.error.kind).toBe("parse");
  });

  it("returns SchemaError on schema mismatch", () => {
    const parseUser = parseJsonWith(UserSchema);
    const result = parseUser('{"name":"john"}');
    expect(isErr(result) && result.error.kind).toBe("schema");
  });

  it("preserves point-free signature and error types", () => {
    const parseUser = parseJsonWith(UserSchema);
    type ParseUserFn = typeof parseUser;
    expectType<TypeEqual<ReturnType<ParseUserFn>, Result<User, ParseError | SchemaError>>>(true);
    expectType<TypeEqual<Parameters<ParseUserFn>[0], string>>(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 6 — Reusable validator ladder via flow + recover
// ─────────────────────────────────────────────────────────────────────────────

type CharsError = { kind: "chars"; bad: string };

type TooShortError = { kind: "too_short"; min: number };

const requireMin = (min: number) => (s: string) =>
  s.length >= min ? ok(s) : err({ kind: "len" as const, min });

const requireAscii = (s: string) =>
  /^[\x20-\x7e]*$/.test(s) ? ok(s) : err({ kind: "chars" as const, bad: s });

const validateUsername = flow(
  (raw: string) => ok(raw.trim()),
  flatMap(requireMin(3)),
  flatMap(requireAscii),
  recover(
    (e): Result<string, TooShortError | CharsError> =>
      e.kind === "len" ? err({ kind: "too_short" as const, min: e.min }) : err(e),
  ),
);

describe("recipe 6 — reusable validator ladder", () => {
  it("returns Ok on valid username", () => {
    expect(validateUsername("  john  ")).toEqual(ok("john"));
  });

  it("returns too_short error on short username", () => {
    expect(validateUsername("  jo  ")).toEqual(err({ kind: "too_short", min: 3 }));
  });

  it("returns chars error on non-ascii characters", () => {
    expect(validateUsername("  jöhn  ")).toEqual(err({ kind: "chars", bad: "jöhn" }));
  });

  it("preserves validator output and error types", () => {
    type ExpectedType = Result<string, TooShortError | CharsError>;
    expectType<TypeEqual<ReturnType<typeof validateUsername>, ExpectedType>>(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 12 — Async pipelines via ResultAsync composition
// ─────────────────────────────────────────────────────────────────────────────

type Profile = { id: string; name: string };
type Metrics = { score: number };
type Summary = { name: string; score: number };

const fetchProfileStub = (id: string): ResultAsync<Profile, Error> =>
  ResultAsync.ok({ id, name: "Alice" });

const fetchMetricsStub = (_p: Profile): ResultAsync<Metrics, Error> =>
  ResultAsync.ok({ score: 99 });

const formatSummary = (p: Profile, m: Metrics): Summary => ({
  name: p.name,
  score: m.score,
});

describe("recipe 12 — async pipelines via ResultAsync composition", () => {
  it("composes async steps successfully", async () => {
    const loadSummary = flow(fetchProfileStub, (ra) =>
      ra.flatMap((profile) =>
        fetchMetricsStub(profile).map((metrics) => formatSummary(profile, metrics)),
      ),
    );

    const result = await loadSummary("123");
    expect(result).toEqual(ok({ name: "Alice", score: 99 }));
  });

  it("preserves async pipeline types", () => {
    const loadSummary = flow(fetchProfileStub, (ra) =>
      ra.flatMap((profile) =>
        fetchMetricsStub(profile).map((metrics) => formatSummary(profile, metrics)),
      ),
    );
    type LoadSummaryFn = typeof loadSummary;
    expectType<TypeEqual<ReturnType<LoadSummaryFn>, ResultAsync<Summary, Error>>>(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recipe 13 — Functional Railway pipelines (railway + named steps)
// ─────────────────────────────────────────────────────────────────────────────

import { deriveNamed, fromPromiseNamed, parseNamed, railway, select } from "../src/railway.js";

type Dashboard = { title: string };

type IdContext = { readonly id: string };
type ProfileContext = { readonly profile: Profile };
type TitleContext = { readonly title: string };

const IdSchema = {
  parse: (x: unknown): string => {
    if (typeof x === "string") return x;
    throw new Error("Invalid ID");
  },
};

const fetchProfileMock = async (id: string): Promise<Profile> => ({
  id,
  name: "Alice",
});

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

describe("recipe 13 — functional railway pipelines", () => {
  it("builds and executes an async pipeline using railway steps", async () => {
    const loadDashboard = (rawId: unknown): ResultAsync<Dashboard, Error> =>
      railway(
        rawId,
        parseNamed("id", IdSchema, toError),
        fromPromiseNamed("profile", ({ id }: IdContext) => fetchProfileMock(id), toError),
        deriveNamed("title", ({ profile }: ProfileContext) => profile.name.toUpperCase()),
        select(({ title }: TitleContext) => ({ title })),
      );

    const result = await loadDashboard("123");
    expect(result).toEqual(ok({ title: "ALICE" }));
  });

  it("preserves functional railway output and error types", () => {
    const loadDashboard = (rawId: unknown): ResultAsync<Dashboard, Error> =>
      railway(
        rawId,
        parseNamed("id", IdSchema, toError),
        fromPromiseNamed("profile", ({ id }: IdContext) => fetchProfileMock(id), toError),
        deriveNamed("title", ({ profile }: ProfileContext) => profile.name.toUpperCase()),
        select(({ title }: TitleContext) => ({ title })),
      );
    type LoadDashboardFn = typeof loadDashboard;
    expectType<TypeEqual<ReturnType<LoadDashboardFn>, ResultAsync<Dashboard, Error>>>(true);
  });
});
