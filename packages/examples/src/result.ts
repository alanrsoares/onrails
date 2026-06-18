// #region snippet
import { ResultAsync, tryAsync } from "../../result/src/index.js";
import { api, decodeUser, type User } from "./fixtures.js";

type FetchError =
  | { kind: "network"; cause: unknown }
  | { kind: "not_found" }
  | { kind: "decode"; issues: string[] };

// neverthrow-style: replace try/catch around fetch with one typed error channel.
export const getUser = (id: string): ResultAsync<User, FetchError> =>
  tryAsync(api.getUser(id), (cause): FetchError => ({ kind: "network", cause }))
    .flatMap((row) =>
      row === null ? ResultAsync.err({ kind: "not_found" as const }) : ResultAsync.ok(row),
    )
    .flatMap(decodeUser);

// Settle once and handle every error in the union — exhaustively, no throws.
export const respond = (id: string) =>
  getUser(id).match(
    (user) => ({ status: 200, body: user }),
    (e) =>
      e.kind === "not_found"
        ? { status: 404, body: "No such user" }
        : { status: 502, body: "Upstream unavailable" },
  );
// #endregion snippet
