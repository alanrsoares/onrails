# onrails brand

The mark is a **portal with a track running out of it**: a railway tunnel arch,
open at the bottom, with two rails converging on a vanishing point and three
sleepers thickening in perspective. It reads as "on rails" literally, and as
the railway-oriented programming metaphor the library is built on — one track,
one direction, no derailing.

## Assets

| File | Use |
| --- | --- |
| `mark.svg` | Primary mark. Three sleepers, fine strokes. Use at **≥32px**. |
| `mark-sm.svg` | Small-size mark. Two sleepers, heavier strokes so it survives **16–24px**. Shipped as `apps/docs/app/icon.svg` (favicon + nav). |
| `mark-mono.svg` | Single-colour mark, inherits `currentColor`. For print, stickers, terminals, anywhere the gradient can't go. |
| `preview.html` | Contact sheet: every size, light and dark, plus the lockup. Open in a browser. |

## Geometry

Everything sits on a `0 0 32 32` grid, centre `(16, 16)`.

- Portal arc: `r = 12`, open across a 104° gap at the bottom (endpoints at `y = 23.388`).
- Vanishing point: `(16, 13.5)`. Both rails aim at it; they stop short of it so the apex stays open.
- Sleepers: `y = 18 / 22 / 27`, half-widths derived from the rail slope (`0.6875` px per px) plus a `0.8` overhang.

Keep the geometry if you re-cut the mark — the perspective only reads correctly
when the sleeper spacing and thickness both grow toward the viewer.

## Colour

The gradient runs **along the track**, from `(6, 30)` to `(26, 4)`: emerald at
the near rail, indigo into the portal. That direction is load-bearing — it gives
the mark depth. A flat top-left→bottom-right gradient flattens it out.

| Stop | Token |
| --- | --- |
| `0` | `#10b981` emerald-500 |
| `0.5` | `#3b82f6` blue-500 |
| `1` | `#6366f1` indigo-500 |

On dark backgrounds the same gradient holds; no dark-mode variant is needed.

## Lockup

Mark + `onrails` set in Inter, weight 640, letter-spacing `-0.025em`, all
lowercase. Gap is ~25% of the mark's height; optical centre the text on the
mark, not its bounding box. There's no baked wordmark file on purpose — the
docs nav composes it from the icon and live text so it inherits the page font.

## Clear space

One sleeper-width (≈2px on the 32 grid) on every side. Don't crop the portal
arc, don't fill the arch, don't rotate the mark.
