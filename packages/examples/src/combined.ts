// #region snippet
import { fromNullable } from "../../maybe/src/index.js";
import { toResult } from "../../maybe/src/interop.js";
import { match } from "../../pattern/src/index.js";
import * as R from "../../result/src/index.js";
import { charge, loadCart, users } from "./fixtures.js";

type OrderError =
  | { kind: "no_user"; id: string }
  | { kind: "empty_cart" }
  | { kind: "declined"; reason: string };

// do-notation: $ unwraps an Ok or short-circuits. Maybe crosses into Result via toResult.
// Annotate the return: $ short-circuits are thrown, so its error types aren't inferred.
export const checkout = (userId: string): R.Result<{ orderId: string }, OrderError> =>
  R.tryGen(() => {
    const user = R.$(
      toResult(
        fromNullable(users.get(userId)),
        (): OrderError => ({ kind: "no_user", id: userId }),
      ),
    );
    const cart = R.$(loadCart(user.id));
    if (cart.items.length === 0) return R.err({ kind: "empty_cart" as const });
    const receipt = R.$(charge(cart));
    return R.ok({ orderId: receipt.id });
  });

// Result's own match forks Ok/Err; @onrails/pattern handles the error variants.
export const message = R.match(
  checkout("u1"),
  (order) => `Order ${order.orderId} confirmed`,
  (e) =>
    match(e)
      .with({ kind: "no_user" }, () => "Please sign in")
      .with({ kind: "empty_cart" }, () => "Your cart is empty")
      .with({ kind: "declined" }, (x) => `Payment declined: ${x.reason}`)
      .exhaustive(),
);
// #endregion snippet
