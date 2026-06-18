// #region snippet
import { flatMap, fromNullable, map, unwrapOr } from "../../maybe/src/index.js";
import { user } from "./fixtures.js";

// fp-ts Option-style: walk nullable fields safely, then supply a default.
// No optional-chaining soup, no scattered null checks.
const city = flatMap(fromNullable(user.address), (addr) => fromNullable(addr.city));

export const label = unwrapOr(
  map(city, (c) => c.name.toUpperCase()),
  "UNKNOWN",
);
// #endregion snippet
