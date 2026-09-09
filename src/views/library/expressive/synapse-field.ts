/**
 * **The Library's synapse field** — the ambient network behind the guided pane.
 *
 * The owner, 2026-09-09, on the centred stepper: *"the centre is good now, but the
 * background is a bit plain — can't we put some effect in? something like a background of
 * neurons connecting, or a graph connecting up."*
 *
 * ## What it is, and what it is careful not to be
 *
 * It is **texture, not data**. The Library's real folder is drawn in two places already —
 * the 2D graph behind the `Graph` chip, and the stepper's own sentences — and both are
 * exact. A working folder is also *small*: the frame that settled this had ten marks, and
 * ten marks spread across a pane read as debris rather than as a field. So this draws no
 * count, no title and no link that exists; it is the Library's **idea** (documents finding
 * each other) as a ground, and it says nothing a person could mistake for a fact about
 * their files.
 *
 * That distinction is what keeps `docs/DESIGN-SYSTEM.md`'s "a mark carries a fact or it
 * goes" intact rather than bent: this is not a mark on a chart with the fact filed off, it
 * is a background on a guidance screen that carries no chart at all.
 *
 * ## Why the maths is here
 *
 * The same contract the map's expressive folder keeps: plain numbers in, plain numbers
 * out, no canvas, no React, no DOM, no clock of its own. The host steps it and paints it.
 * That is what makes a field testable — that points stay in frame, that links appear only
 * within reach, that a link's weight falls off with distance — without a browser.
 */

export interface SynapseNode {
  x: number;
  y: number;
  /** Units per millisecond. */
  vx: number;
  vy: number;
}

export interface SynapseLink {
  a: number;
  b: number;
  /** 1 at touching distance, 0 at the reach limit. What the host turns into alpha. */
  strength: number;
}

export interface SynapseFieldOptions {
  /** How many points. */
  count: number;
  /** Farthest two points can be and still be linked, in the same units as positions. */
  reach: number;
  /** Field extent: positions live in `[0,width] × [0,height]`. */
  width: number;
  height: number;
  /** Deterministic start, so a reload is the same field and a test can name a point. */
  seed?: number;
}

/**
 * A small deterministic generator.
 *
 * `Math.random` would make the field different on every mount, which is a problem twice
 * over: a reduced-motion viewer gets one still frame and it should be a considered one,
 * and a screenshot gate cannot compare two frames of a field that reseeds itself.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

/** Speed range, units per millisecond. Slow enough that nothing crosses the eye. */
const SPEED_MIN = 0.0016;
const SPEED_MAX = 0.0052;

/**
 * Seed the field.
 *
 * ⚠️ **Placement is a jittered grid, not `count` independent random picks.** Independent
 * picks clump: the first rendered field left the top-left quarter of the pane nearly bare
 * while the bottom-right carried a knot, and an uneven background reads as a rendering
 * fault rather than as texture — the same reason the constellation's marks go on a
 * Fibonacci spiral. One point per cell of a roughly square grid guarantees coverage; the
 * jitter inside each cell is what keeps it from reading as a lattice.
 */
export function createSynapseField(options: SynapseFieldOptions): SynapseNode[] {
  const random = rng(options.seed ?? 0x5eed);
  const count = Math.max(0, Math.floor(options.count));
  const nodes: SynapseNode[] = [];
  if (count === 0) return nodes;

  // Columns chosen so the cells are as square as the field allows; a grid of tall cells
  // puts the points in visible rows.
  const columns = Math.max(1, Math.round(Math.sqrt((count * options.width) / Math.max(1, options.height))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = options.width / columns;
  const cellHeight = options.height / rows;

  for (let i = 0; i < count; i += 1) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const angle = random() * Math.PI * 2;
    const speed = SPEED_MIN + random() * (SPEED_MAX - SPEED_MIN);
    nodes.push({
      x: Math.min(options.width, (column + random()) * cellWidth),
      y: Math.min(options.height, (row + random()) * cellHeight),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });
  }
  return nodes;
}

/**
 * Advance the field by `dtMs`, in place.
 *
 * Points **wrap** rather than bouncing off the edges. A bounce puts a visible rhythm on
 * the boundary — points gathering and turning at the same lines — which reads as a box
 * around a thing that is supposed to have no edges. Wrapping keeps the field endless, and
 * the host's own fade at the pane's rim is what hides the crossing.
 */
export function stepSynapseField(
  nodes: SynapseNode[],
  dtMs: number,
  width: number,
  height: number,
): void {
  const dt = Math.min(64, Math.max(0, dtMs));
  for (const node of nodes) {
    node.x += node.vx * dt;
    node.y += node.vy * dt;
    if (node.x < 0) node.x += width;
    else if (node.x > width) node.x -= width;
    if (node.y < 0) node.y += height;
    else if (node.y > height) node.y -= height;
  }
}

/**
 * Every pair within `reach`, with the weight the host paints them at.
 *
 * Linear falloff rather than a hard cut: a link that appears at full strength the instant
 * two points come into range flickers, and a flicker in a background is the one thing a
 * background must never do.
 *
 * O(n²), and deliberately so at this size — the host's `count` is in the tens, and a
 * quadtree here would be a structure to maintain for a loop that costs microseconds.
 */
export function synapseLinks(nodes: readonly SynapseNode[], reach: number): SynapseLink[] {
  const links: SynapseLink[] = [];
  if (reach <= 0) return links;
  const reachSquared = reach * reach;
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      const dx = nodes[a]!.x - nodes[b]!.x;
      const dy = nodes[a]!.y - nodes[b]!.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= reachSquared) continue;
      links.push({ a, b, strength: 1 - Math.sqrt(distanceSquared) / reach });
    }
  }
  return links;
}
