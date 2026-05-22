import { describe, expect, it } from "bun:test";
import { errAsync, okAsync, ResultAsync } from "../src/async.js";
import {
  deriveNamed,
  fromPromiseNamed,
  parallelNamed,
  parseWith,
  Railway,
  railway,
  requireNamed,
  select,
} from "../src/railway.js";
import { err, ok } from "../src/result.js";

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

describe("Railway", () => {
  it("returns a sync Result for sync-only workflows", () => {
    const result = Railway.fromSync("id", () => "profile-1", toError)
      .derive("slug", ({ id }) => `${id}-slug`)
      .select(({ id, slug }) => ({ id, slug }));

    expect(result).toEqual(ok({ id: "profile-1", slug: "profile-1-slug" }));
  });

  it("short-circuits sync Result steps", () => {
    const result = Railway.fromResult("id", () => err("bad-id"))
      .derive("slug", () => "never")
      .done();

    expect(result).toEqual(err("bad-id"));
  });

  it("maps thrown sync boundaries", () => {
    const result = Railway.fromSync(
      "id",
      () => {
        throw new Error("boom");
      },
      (error) => (error instanceof Error ? error.message : "unknown"),
    ).done();

    expect(result).toEqual(err("boom"));
  });

  it("upgrades to ResultAsync when a Promise step appears", async () => {
    const result = Railway.fromSync("id", () => "profile-1", toError)
      .fromPromise("row", ({ id }) => Promise.resolve({ id, name: "Ada" }), toError)
      .select(({ row }) => row.name);

    expect(result).toBeInstanceOf(ResultAsync);
    expect(await result.resolve()).toEqual(ok("Ada"));
  });

  it("maps Promise rejections", async () => {
    const result = Railway.fromPromise(
      "row",
      () => Promise.reject(new Error("db down")),
      (error) => (error instanceof Error ? error.message : "unknown"),
    ).done();

    expect(await result.resolve()).toEqual(err("db down"));
  });

  it("short-circuits async Result steps", async () => {
    const result = Railway.fromSync("id", () => "profile-1", toError)
      .fromAsync("row", () => errAsync("not-found"))
      .derive("name", () => "never")
      .done();

    expect(await result.resolve()).toEqual(err("not-found"));
  });

  it("requires nullable values and narrows them under a new key", async () => {
    const result = Railway.fromPromise(
      "row",
      () => Promise.resolve<{ id: string } | null>({ id: "profile-1" }),
      toError,
    )
      .require("profile", "row", () => new Error("missing"))
      .select(({ profile }) => profile.id);

    expect(await result.resolve()).toEqual(ok("profile-1"));
  });

  it("returns Err when require sees nullish values", async () => {
    const result = Railway.fromPromise(
      "row",
      () => Promise.resolve<{ id: string } | null>(null),
      toError,
    )
      .require("profile", "row", () => new Error("missing"))
      .select(({ profile }) => profile.id);

    const resolved = await result.resolve();
    expect(resolved._tag).toBe("Err");
    if (resolved._tag === "Err") {
      expect(resolved.error.message).toBe("missing");
    }
  });

  it("merges parallel branch outputs", async () => {
    const result = Railway.fromSync("id", () => "profile-1", toError)
      .parallel({
        recent: ({ id }) => okAsync([id, "artifact-2"]),
        metrics: () => okAsync({ jobs: 2 }),
      })
      .select(({ id, recent, metrics }) => ({ id, recent, metrics }));

    expect(await result.resolve()).toEqual(
      ok({
        id: "profile-1",
        recent: ["profile-1", "artifact-2"],
        metrics: { jobs: 2 },
      }),
    );
  });

  it("short-circuits when a parallel branch fails", async () => {
    const result = Railway.fromSync("id", () => "profile-1", toError)
      .parallel({
        recent: () => okAsync(["artifact-1"]),
        metrics: () => errAsync("metrics-failed"),
      })
      .done();

    expect(await result.resolve()).toEqual(err("metrics-failed"));
  });
});

describe("functional railway", () => {
  const parseProfileId = parseWith((input: string) => input.trim(), toError).as("profileId");

  const loadProfileRow = fromPromiseNamed(
    "row",
    ({ profileId }: { readonly profileId: string }) =>
      Promise.resolve<{ id: string; name: string } | null>({ id: profileId, name: "Ada" }),
    toError,
  );

  const requireProfile = requireNamed(
    "profile",
    "row",
    ({ profileId }: { readonly profileId: string }) => new Error(`missing ${profileId}`),
  );

  const normalize = deriveNamed(
    "normalized",
    ({ profile }: { readonly profile: { readonly id: string; readonly name: string } }) => ({
      id: profile.id,
      label: profile.name.toUpperCase(),
    }),
  );

  const loadSummaryInputs = parallelNamed({
    recent: ({ normalized }: { readonly normalized: { readonly id: string } }) =>
      okAsync([normalized.id]),
    metrics: () => okAsync({ jobs: 2 }),
  });

  it("composes reusable steps", async () => {
    const result = railway(
      " profile-1 ",
      parseProfileId,
      loadProfileRow,
      requireProfile,
      normalize,
      loadSummaryInputs,
      select(({ normalized, recent, metrics }) => ({ normalized, recent, metrics })),
    );

    expect(await result.resolve()).toEqual(
      ok({
        normalized: { id: "profile-1", label: "ADA" },
        recent: ["profile-1"],
        metrics: { jobs: 2 },
      }),
    );
  });
});
