/**
 * Ego light — the three pieces of light a focus or hover puts on the map:
 *
 * - the **ground halo**: an indigo radial gradient under the focused node whose
 *   radius reaches the farthest 1-hop neighbour plus a pad (hop depth as light);
 * - the **node bloom**: a blurred indigo disc under the focused or hovered node;
 * - the **edge glow**: a canvas shadow set around the ego lines while they draw.
 *
 * Every piece takes a `ramp` (0..1, the host's focus or emphasis ramp) so it
 * arrives and leaves with the state it marks, and paints nothing at 0. Screen
 * coordinates in, canvas calls out; no world, camera, or React knowledge.
 */

export interface EgoLightTokens {
  indigo: string;
  indigoBright: string;
  /** `--topology-v2-ego-halo-alpha` */
  egoHaloAlpha: number;
  /** `--topology-v2-ego-halo-pad` (screen px) */
  egoHaloPad: number;
  /** `--topology-v2-ego-glow-blur-px` */
  egoGlowBlurPx: number;
  /** `--topology-v2-ego-glow-alpha` */
  egoGlowAlpha: number;
  /** `--topology-v2-node-bloom-alpha` */
  nodeBloomAlpha: number;
}

/** `#rrggbb` (or `#rgb`) → `rgba(r,g,b,a)`, which a `CanvasGradient` stop can take where a `var()` cannot. */
export function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
}

export interface ScreenDisc {
  x: number;
  y: number;
  r: number;
}

/** How far the halo reaches: the farthest neighbour's far rim, or the centre's own radius. */
export function egoHaloReach(center: ScreenDisc, neighbours: Iterable<ScreenDisc>): number {
  let reach = center.r;
  for (const n of neighbours) {
    const d = Math.hypot(n.x - center.x, n.y - center.y) + n.r;
    if (d > reach) reach = d;
  }
  return reach;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The ground halo. Grows from 72% to 100% of its reach on the ramp so it arrives with
 * the dive rather than popping; alpha rides the ramp too. Draw it under the edges.
 */
export function drawEgoHalo(
  ctx: CanvasRenderingContext2D,
  state: { cx: number; cy: number; reach: number; ramp: number },
  tokens: Pick<EgoLightTokens, "indigo" | "egoHaloAlpha" | "egoHaloPad">,
): void {
  const ramp = clamp01(state.ramp);
  if (ramp <= 0.001 || tokens.egoHaloAlpha <= 0) return;
  const r = (state.reach + tokens.egoHaloPad) * (0.72 + 0.28 * ramp);
  if (!(r > 0)) return;
  const a = tokens.egoHaloAlpha * ramp;
  const halo = ctx.createRadialGradient(state.cx, state.cy, 0, state.cx, state.cy, r);
  halo.addColorStop(0, hexWithAlpha(tokens.indigo, a));
  halo.addColorStop(0.55, hexWithAlpha(tokens.indigo, a * 0.45));
  halo.addColorStop(1, hexWithAlpha(tokens.indigo, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(state.cx, state.cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The bloom under one node. Restores `shadowBlur` and `globalAlpha` before returning. */
export function drawNodeBloom(
  ctx: CanvasRenderingContext2D,
  disc: ScreenDisc,
  ramp: number,
  tokens: Pick<EgoLightTokens, "indigo" | "indigoBright" | "egoGlowBlurPx" | "nodeBloomAlpha">,
): void {
  const k = clamp01(ramp);
  if (k <= 0.001) return;
  const prevAlpha = ctx.globalAlpha;
  ctx.shadowColor = hexWithAlpha(tokens.indigoBright, 0.9 * k);
  ctx.shadowBlur = tokens.egoGlowBlurPx * 1.4 * k;
  ctx.fillStyle = hexWithAlpha(tokens.indigo, tokens.nodeBloomAlpha * k);
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.r * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = prevAlpha;
}

/**
 * Edge glow: set the canvas shadow for the strokes that follow. Returns true when
 * it did, so the caller pairs it with `endEdgeGlow`. Nothing is set at ramp 0.
 */
export function beginEdgeGlow(
  ctx: CanvasRenderingContext2D,
  ramp: number,
  tokens: Pick<EgoLightTokens, "indigo" | "egoGlowBlurPx" | "egoGlowAlpha">,
): boolean {
  const k = clamp01(ramp);
  if (k <= 0.001) return false;
  ctx.shadowColor = hexWithAlpha(tokens.indigo, tokens.egoGlowAlpha * k);
  ctx.shadowBlur = tokens.egoGlowBlurPx * k;
  return true;
}

export function endEdgeGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
}
