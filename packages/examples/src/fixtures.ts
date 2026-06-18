// Shared, realistic stubs so the snippet modules compile and run. None of this
// appears in the rendered docs — the snippet regions reference these as if they
// were ambient application code.

import type { Result } from "../../result/src/index.js";
import { err, ok } from "../../result/src/index.js";

export type User = {
  id: string;
  name: string;
  displayName: string;
  active: boolean;
  address: { city: { name: string } | null } | null;
};

export type Post = { id: string; title: string };
export type Cart = { items: readonly string[]; total: number };
export type Receipt = { id: string };

export const api = {
  getUser: (id: string): Promise<unknown> =>
    Promise.resolve({ id, name: "Ada", displayName: "Ada Lovelace" }),
};

export const decodeUser = (json: unknown): Result<User, { kind: "decode"; issues: string[] }> => {
  if (typeof json === "object" && json !== null && "id" in json) {
    const o = json as Record<string, unknown>;
    return ok({
      id: String(o.id),
      name: String(o.name ?? ""),
      displayName: String(o.displayName ?? ""),
      active: true,
      address: null,
    });
  }
  return err({ kind: "decode", issues: ["expected a user object"] });
};

export const user: User = {
  id: "u1",
  name: "Ada",
  displayName: "Ada Lovelace",
  active: true,
  address: { city: { name: "London" } },
};

export const users = new Map<string, User>([[user.id, user]]);

export const loadCart = (_userId: string): Result<Cart, never> =>
  ok({ items: ["sku-1", "sku-2"], total: 4200 });

export const charge = (_cart: Cart): Result<Receipt, { kind: "declined"; reason: string }> =>
  ok({ id: "rcpt_1" });
