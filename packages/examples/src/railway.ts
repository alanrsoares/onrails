// #region snippet
import { fromNullable } from "../../maybe/src/index.js";
import { toResult } from "../../maybe/src/interop.js";
import { err } from "../../result/src/index.js";
import { Railway } from "../../result/src/railway.js";
import { charge, loadCart, users } from "./fixtures.js";

type CheckoutError =
  | { kind: "no_user"; id: string }
  | { kind: "empty_cart" }
  | { kind: "declined"; reason: string };

// Railway threads a growing context object through each step; errors accumulate
// into one union, and every step sees the keys added before it.
export const checkout = (userId: string) =>
  Railway.fromResult("user", () =>
    toResult(
      fromNullable(users.get(userId)),
      (): CheckoutError => ({ kind: "no_user", id: userId }),
    ),
  )
    .fromResult("cart", ({ user }) => loadCart(user.id))
    .fromResult("receipt", ({ cart }) =>
      cart.items.length === 0
        ? err<{ id: string }, CheckoutError>({ kind: "empty_cart" })
        : charge(cart),
    )
    .derive("orderId", ({ receipt }) => receipt.id)
    .select(({ user, orderId }) => ({ orderId, customer: user.name }));
// #endregion snippet
