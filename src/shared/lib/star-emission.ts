/**
 * **A node, emitting — the walked path's star.**
 *
 * The painting half of the walked-path mark, with nothing in it that knows about the map: no
 * node kinds, no camera, no tokens, no clock. The caller hands it a silhouette to trace and a
 * level to burn at, so the same function draws a walked concept on the topology canvas and the
 * same concept in the settings preview.
 *
 * ⚠️ **It lives in `shared/` because the preview was drawing a different mark from the map.**
 * The settings panel painted the star *glyph* — a small four-point sparkle set beside a dark
 * node, and a row of them strung along the relation — while the map lit the node itself. Its
 * own caption described the map's behaviour correctly, so the words and the picture on that
 * panel disagreed, and the picture showed the notation the owner had already rejected: *"that
 * isn't the kind of star I meant — I mean the node's own border lighting up"* (2026-09-10).
 * The tone table was unified for exactly this reason earlier the same day and the painting was
 * left behind; one function is the rest of that repair.
 *
 * ⚠️ Two builds got the mark itself wrong before it worked, and both were the same mistake in
 * different clothes — painting a *mark* instead of making the node *bright*. A glyph beside the
 * node is the footprint notation in another shape. A pale outline stroke earned the verdict
 * *"it's just dark grey"*, and it was, because paint on a dark canvas is paint. Light on a dark
 * canvas has to **add**, which is why this composites with `lighter`.
 *
 * ## Why there is no cross on it
 *
 * There was one — `drawDiffractionSpike`'s four arms, the signature every bright node on this
 * canvas wears — and it went in two steps. design-infoviz measured that a walked star and a
 * magnitude spike wore the same primitive within one frame, separated only by hue at 1.68:1,
 * and offered two repairs: separate them by form, or drop the cross and let the lit rim and the
 * ordinal carry it. Form was tried first — turned 45 degrees and clamped clear of the label
 * ring — and rendered as an **X drawn across the node** rather than as light coming off it. A
 * diffraction spike belongs on a *point* of light; one centred on a 15-33 px silhouette crosses
 * the very thing it is meant to decorate. The second repair is also the smaller one: it removes
 * the semantic overlap instead of mitigating it. Nothing was lost with it — the cross said
 * "this is the end of the walk", and the end of the walk is the stop you are standing on,
 * already lit in the selection's own indigo and already numbered beside it.
 */

/**
 * How far the star's bloom reaches, in node radii.
 *
 * ⚠️ 3.2 with a gentle falloff measured as **fog** rather than as a star — a soft blob wide
 * enough to touch its neighbours, with the diffraction cross drowned inside it. A star is a
 * point of light: bright and tight at the core, gone quickly.
 */
const STAR_GLOW_REACH = 2.0;

/**
 * Where the bloom starts, in node radii — and therefore where the hole in it ends.
 *
 * Just outside the silhouette rather than on it: at exactly 1.0 the antialiased edge of the
 * hole and the outline stroke land on the same pixels and the seam reads as a notch.
 */
const STAR_GLOW_INNER = 1.04;



export interface StarEmissionState {
  x: number;
  y: number;
  /** The node's own screen radius. Everything else is a multiple of it. */
  radius: number;
  /** `#rrggbb`. Star ink for a walked node; the selection's indigo for the one you stand on. */
  ink: string;
  /** 0–1. Below 0.01 nothing is painted. */
  lit: number;
  /**
   * Multiplier on the bloom's reach while the star is igniting.
   *
   * A star arriving has a size, not only a brightness — the light swells out and settles back.
   * It returns to 1 once the ignition is over, so a settled constellation is dimensionally
   * still and nothing on the canvas keeps breathing.
   */
  swell?: number;
  /**
   * Traces the node's silhouette at `radius` into the current path, without stroking it.
   *
   * A callback rather than a kind, because the two callers disagree about what a node looks
   * like and neither is wrong: the map has hexagons, squares and circles that converge with
   * altitude; the settings preview has one rounded rectangle standing for all of them. What
   * they must agree on is the *light*, which is what this file owns.
   */
  tracePath: (ctx: CanvasRenderingContext2D, radius: number) => void;
}

/** `#rrggbb` → `rgba(...)`, which a gradient stop takes where a `var()` cannot. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

export function drawStarEmission(ctx: CanvasRenderingContext2D, state: StarEmissionState): void {
  const { x, y, radius, ink, lit, tracePath } = state;
  if (lit <= 0.01 || radius <= 0) return;
  const k = Math.min(1, lit);
  const swell = state.swell ?? 1;
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";

  // The light it throws. A gradient rather than a shadow blur: `shadowBlur` on a hairline
  // spends almost all of itself on nothing, which is exactly why the outline read as grey.
  const reach = radius * STAR_GLOW_REACH * swell;
  const inner = radius * STAR_GLOW_INNER;
  const glow = ctx.createRadialGradient(x, y, inner, x, y, reach);
  glow.addColorStop(0, withAlpha(ink, 0.5 * k));
  glow.addColorStop(0.26, withAlpha(ink, 0.14 * k));
  glow.addColorStop(0.58, withAlpha(ink, 0.035 * k));
  glow.addColorStop(1, withAlpha(ink, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  /*
   * ⚠️ **The rim lights; the face does not — and for three days that was a comment rather than
   * a fact.** The bloom was a gradient from `radius * 0.35` painted with a plain disc, and a
   * radial gradient fills everything inside its inner circle with stop 0, so the face took a
   * solid additive wash at α 0.62. design-infoviz scanned a walked node and found every sample
   * from −15 px to +21 px at `rgb(255,255,255)`: the node's own engraved count against its own
   * face at **1.00:1**, erased, on exactly the nodes a person had just walked (2026-09-10).
   * Cutting the disc back out of the path makes the sentence true by construction instead of
   * by a gradient stop that happened to be low.
   */
  ctx.beginPath();
  ctx.arc(x, y, reach, 0, Math.PI * 2);
  ctx.arc(x, y, inner, 0, Math.PI * 2, true);
  ctx.fill();

  // The edge itself, on the node's real silhouette — never a circle over a square.
  ctx.globalAlpha = k;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  tracePath(ctx, radius);
  ctx.stroke();

  ctx.globalCompositeOperation = prevOp;
  ctx.globalAlpha = prevAlpha;
}
