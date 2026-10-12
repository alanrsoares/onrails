/**
 * Unlocked constructors for library internals.
 *
 * The public {@link ok} / {@link err} take `const` type parameters so caller
 * literals stay narrow. Internals must never narrow a payload type, so they
 * build results through these aliases instead.
 *
 * Re-exported (not wrapped) so `mkOk` / `mkErr` are a single call hop to the
 * carrier constructor — same as the public path.
 */
export { newErr as mkErr, newOk as mkOk } from "./proto.js";
