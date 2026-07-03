import { describe, expect, it } from "bun:test";
import { ResultAsync } from "../src/async.js";
import { errAsync, okAsync } from "../src/async-lift.js";
import { Railway } from "../src/railway.js";
import { err, ok } from "../src/result.js";

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

describe("Railway: sync workflows", () => {
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
});

describe("Railway: async upgrade", () => {
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
});

describe("Railway: require", () => {
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
});

describe("Railway: parallel", () => {
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

  it("parallel overlaps lazy branch work", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const lazy = <T>(value: T) =>
      ResultAsync.defer(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return ok(value);
      });

    const out = await Railway.fromSync("id", () => "profile-1", toError)
      .parallel({
        recent: () => lazy(["a"]),
        metrics: () => lazy({ jobs: 1 }),
      })
      .done()
      .resolve();

    expect(out).toEqual(
      ok({
        id: "profile-1",
        recent: ["a"],
        metrics: { jobs: 1 },
      }),
    );
    expect(maxInFlight).toBe(2);
  });
});

type ProfileRow = { readonly id: string; readonly name: string };
type NormalizedProfile = { readonly id: string; readonly label: string };

describe("Railway: end-to-end workflow", () => {
  it("chains parse, load, require, derive, parallel, and select", async () => {
    const result = Railway.fromSync("profileId", () => " profile-1 ".trim(), toError)
      .fromPromise(
        "row",
        ({ profileId }) => Promise.resolve<ProfileRow | null>({ id: profileId, name: "Ada" }),
        toError,
      )
      .require("profile", "row", ({ profileId }) => new Error(`missing ${profileId}`))
      .derive(
        "normalized",
        ({ profile }): NormalizedProfile => ({
          id: profile.id,
          label: profile.name.toUpperCase(),
        }),
      )
      .parallel({
        recent: ({ normalized }) => okAsync([normalized.id]),
        metrics: () => okAsync({ jobs: 2 }),
      })
      .select(({ normalized, recent, metrics }) => ({ normalized, recent, metrics }));

    expect(await result.resolve()).toEqual(
      ok({
        normalized: { id: "profile-1", label: "ADA" },
        recent: ["profile-1"],
        metrics: { jobs: 2 },
      }),
    );
  });
});
