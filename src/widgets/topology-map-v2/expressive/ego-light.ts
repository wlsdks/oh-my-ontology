/**
 * Ego light — the two pieces of light a focus or hover puts on the map:
 *
 * - the **node bloom**: a blurred indigo disc under the focused or hovered node;
 * - the **edge glow**: a canvas shadow set around the ego lines while they draw.
 *
 * A third piece, a ground halo whose radius reached the farthest 1-hop neighbour,
 * was removed by the design council on 2026-09-08: measured over 36 focus states it
 * enclosed 410 nodes of which 290 (70.7%) were not neighbours, and a degree-3 and a
 * degree-15 node both produced R=620, so the disc asserted a reach the data did not
 * hold. The 1-hop fact is carried by the edge glow, which touches only real relations.
 *
 * Every piece takes a `ramp` (0..1, the host's focus or emphasis ramp) so it
 * arrives and leaves with the state it marks, and paints nothing at 0. Screen
 * coordinates in, canvas calls out; no world, camera, or React knowledge.
 */

export interface EgoLightTokens {
  indigo: string;
  indigoBright: string;
  /** `--topology-v2-ego-glow-blur-px` */
  egoGlowBlurPx: number;
  /** `--topology-v2-ego-glow-alpha` */
  egoGlowAlpha: number;
  /** `--topology-v2-node-bloom-blur-px` */
  nodeBloomBlurPx: number;
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

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The bloom under one node. Restores `shadowBlur` and `globalAlpha` before returning. */
export function drawNodeBloom(
  ctx: CanvasRenderingContext2D,
  disc: ScreenDisc,
  ramp: number,
  tokens: Pick<EgoLightTokens, "indigo" | "indigoBright" | "nodeBloomBlurPx" | "nodeBloomAlpha">,
): void {
  const k = clamp01(ramp);
  if (k <= 0.001) return;
  const prevAlpha = ctx.globalAlpha;
  ctx.shadowColor = hexWithAlpha(tokens.indigoBright, 0.9 * k);
  ctx.shadowBlur = tokens.nodeBloomBlurPx * k;
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
