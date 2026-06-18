// #region snippet
import { match } from "../../pattern/src/index.js";
import type { Post } from "./fixtures.js";

type Response =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ok"; posts: Post[] }
  | { status: "error"; code: number };

// ts-pattern-style: render a union to markup, exhaustively.
// Omit a case (or add a variant) and it stops compiling.
export const view = (res: Response) =>
  match(res)
    .with({ status: "loading" }, () => "<spinner />")
    .with({ status: "empty" }, () => "<p>No posts yet</p>")
    .with({ status: "ok" }, (r) => `<ul>${r.posts.length} posts</ul>`)
    .with({ status: "error" }, (r) => `<p>Failed (${r.code})</p>`)
    .exhaustive();
// #endregion snippet
