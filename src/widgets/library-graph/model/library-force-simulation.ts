import type { LibraryGraph, LibraryGraphNodeKind } from "./build-library-graph";
import { LibraryQuadtree } from "./library-graph-quadtree";
import { seedPositions, type LayoutPoint } from "./library-graph-layout";

/**
 * **The library graph is a live force simulation** — the picture is being held in place
 * by forces rather than having been placed once.
 *
 * ## Why this replaced a one-shot layout
 *
 * The first build ran ForceAtlas2 to a stop before the first frame and never ticked
 * again, on the argument that a simulation beside a document a person is reading is
 * movement with nothing to say. The owner looked at the shipped picture on 2026-09-07 —
 * seven sources, six pages, every page citing most of the sources — and rejected it:
 * *"this graph does not move, it is fixed, and that is a shame"* A settled FA2 pass over a graph that
 * dense is a hairball, and a hairball that cannot be pulled apart is a picture a person
 * can only accept or leave. Being able to take one node in hand and see which lines
 * follow **is** the reading operation on a graph this connected, and it needs live
 * physics, not a cached result.
 *
 * `docs/DECISIONS.md`, 2026-09-07, records that reversal and its bounds.
 *
 * ## What the forces say
 *
 * | Force | What it encodes |
 * |---|---|
 * | link spring, rest length by relation | a citation is a closer relationship than a mention: `cites` rests at {@link CITES_REST}, `mentions` at {@link MENTIONS_REST} |
 * | many-body repulsion | two things with nothing between them do not belong in the same place |
 * | collision | a mark never sits on another mark, whatever the springs want |
 * | gravity, **aspect-aware** | the cloud is held in the box it is drawn in, and stretched along the box's long axis rather than fitted into a corner of it |
 * | orphan ring | a mark no relation answers for has a place of its own — one ellipse around the connected mass, evenly spread — rather than the residue of the other two forces, which threw it at a wall |
 *
 * The aspect-aware gravity is the one force here that is not standard, and it is what
 * pays the old layout's measured debt: a uniform fit of a 1.39-aspect cloud into a
 * 3.56-aspect canvas could never fill more than 39% of the width, and the shipped
 * picture measured 33.5% (design-infoviz, 2026-09-06). Stretching the *fit* would have
 * lied about every distance. Stretching the **field the layout is computed in** does
 * not: the distances that come out are true to the forces that produced them, and a
 * uniform scale still draws them.
 *
 * ## Determinism
 *
 * No `Math.random`, no clock, no `performance.now`. Seeds are the golden-angle spiral
 * `seedPositions` already produced, every tie is broken by a fixed rule, and one tick is
 * a function of the state alone — so the same folder settles into the same picture on
 * every machine, and a test can assert positions rather than statistics.
 *
 * ⚠️ **`stepLibrarySimulation` mutates its state and returns it.** Determinism, not
 * immutability, is the property that matters: an 800-node graph at 60fps cannot allocate
 * two arrays of node objects sixty times a second, and every test below asserts the
 * function of the input rather than the identity of the output.
 */

/** Rest length of a citation, in world units. A page holds the file it was written from close. */
const CITES_REST = 52;
/**
 * Rest length of a mention. Longer, so a concept the page merely names sits on the
 * outside of the cluster rather than inside it — the ring of hollow marks around a
 * page's own square of sources is the shape this number exists to produce.
 */
const MENTIONS_REST = 96;

/**
 * Many-body charge. Negative is repulsion, the sign convention `d3-force` uses.
 *
 * Tuned against the owner's own folder shape (7 sources, 6 pages, every page citing 4–7
 * of them): at −140 the clusters overlapped into the hairball this replaced, and at −420
 * the unattached sources were thrown to the edges of the canvas where the fit then shrank
 * everything else to nothing.
 */
const MANY_BODY_STRENGTH = -260;

/**
 * Order at which the exact O(n²) many-body pass hands over to the Barnes–Hut tree.
 *
 * **Measured, and higher than the obvious guess.** One whole tick, mean of 30, on an
 * M-series laptop (2026-09-07):
 *
 * | Nodes | Exact | Barnes–Hut |
 * |---|---|---|
 * | 500 | 0.95 ms | 1.15 ms |
 * | 600 | 1.20 ms | 1.28 ms |
 * | 700 | 1.54 ms | 1.56 ms |
 * | 800 | 1.97 ms | 1.73 ms |
 * | 900 | 2.36 ms | 2.01 ms |
 * | 3000 | 20.8 ms | 8.5 ms |
 *
 * The tree has to be **built** before it can be walked, and a build touches every node;
 * below ~720 that build costs more than the pairs it skips. `library-force-simulation.perf.test.ts`
 * re-measures both passes on the same graph and fails if this ordering inverts.
 */
export const MANY_BODY_EXACT_MAX_ORDER = 720;

/** How hard a node is pulled back toward the centre of the box, per tick. */
const GRAVITY = 0.028;
/** Velocity retained between ticks. `d3-force`'s 0.6 friction, which is a settled default. */
const VELOCITY_DECAY = 0.62;
/** Alpha below which the picture is at rest and the loop may stop stepping. */
const ALPHA_MIN = 0.0015;
/** Per-tick approach of alpha toward its target — about 240 ticks from 1 to `ALPHA_MIN`. */
const ALPHA_DECAY = 0.0275;
/** Alpha a re-heat restores. Not 1: the picture is being disturbed, not rebuilt. */
const REHEAT_ALPHA = 0.42;
/** Iterations of the link/collision relaxation per tick. Two is enough to hold a chain. */
const RELAX_PASSES = 2;
/** Extra room around a mark that no other mark may enter. */
const COLLISION_PAD = 7;
/**
 * Order above which the collision pass bins into a uniform grid instead of testing every
 * pair. Below it the grid's own bookkeeping costs more than the pairs it skips.
 */
const COLLISION_EXACT_MAX_ORDER = 150;

/**
 * **The room a name needs.** The fit reserves this much of the canvas on every side so the
 * outermost mark still has somewhere to put its label, and the orphan ring below is held
 * the same distance off the edge in the simulation's own units — one number, so a mark the
 * physics placed at the boundary and a fit that draws it cannot disagree about where the
 * boundary is. The standing label is `text-label` (11px) on a 15px line, 5px under the
 * mark, on top of a mark up to 10px: 34 is that stack with a pixel to spare.
 */
export const LIBRARY_LABEL_ALLOWANCE = 34;

/**
 * **The orphan ring** — where a mark that is attached to nothing settles.
 *
 * A degree-0 mark is the one node in this model that no spring answers for. It has
 * repulsion pushing it away from everything and gravity pulling it at the centre, and the
 * balance of those two alone is *far out and wherever*: measured on the owner's seeded
 * folder at 1512×917 on 2026-09-07, `interview-notes.txt` sat on the top edge,
 * `design-system.docx` on the bottom one, `Handover notes` on the right, and
 * `kickoff-notes.html` in the bottom-right corner 40px from the fit control, while the two
 * real components sat small in the middle. Nothing was wrong with any single position; the
 * picture read as scattered because four marks had been thrown to four different walls.
 *
 * So the unattached marks are given a place of their own rather than left to the residue
 * of two forces: **one calm ellipse around the connected mass**, its aspect the canvas's,
 * its radius the mass's own bounding radius plus {@link ORPHAN_RING_GAP}, and its angles
 * spread evenly and deterministically by sorted id. It is a gravity target, not a
 * position — orphans still repel, still collide, still drag, and still drift — so the
 * picture stays alive, which `docs/DECISIONS.md` (2026-09-07) requires of it.
 *
 * The ellipse is what keeps the fill the same record measured: a *circular* ring around a
 * 3.56-aspect canvas would make the whole picture as tall as it is wide and give back the
 * width that record's falsifier is stated against.
 */
const ORPHAN_RING_GAP = 56;
/** Ring radius when there is no connected mass to stand off from — a folder of loose files. */
const ORPHAN_RING_MIN_RADIUS = 90;
/**
 * Pull toward the ring slot, per tick. Several times {@link GRAVITY}: the ring is a place
 * the mark belongs, not a preference it drifts toward, and it has to answer the repulsion
 * of every mark in the mass at once.
 */
const ORPHAN_RING_GRAVITY = 0.085;
/**
 * The first slot's angle: **on the ring's short axis, and no half-slot offset.**
 *
 * ⚠️ Two measurements decide this, and the second one narrows the first.
 *
 * **No half-slot offset** (2026-09-07). Half a slot off the top looked tidier written down
 * and put four orphans at ±45°, which is a *rectangle*: each of the four marks is then
 * simultaneously the leftmost-or-rightmost and the topmost-or-bottommost thing in the
 * picture, so the fit — which pins the bounding box to the canvas — lands all four in the
 * four corners, 34px from two walls each and one of them under the fit control. On the axes
 * the extremes are held by different marks instead: the bounding box has empty corners, and
 * each loose mark is near one wall and far from the other three. That still stands, and
 * with four slots the rule below produces exactly the same four angles.
 *
 * **Which axis it starts on** (2026-09-08). It used to be three o'clock, and with *one*
 * loose mark three o'clock is the single worst angle available: the ring is an ellipse with
 * the box's aspect, so the 0° slot sits at its **long** radius and one unattached note
 * decides the whole picture's scale. Measured on the owner's own folder at 1400×860 — 19
 * marks, one of them loose: the connected mass spanned 708×538, and
 * `Meeting notes September` alone stretched the picture to 908×525, aspect **1.79** against
 * a canvas of 1.25. The fit is uniform, so it was width-bound and **35% of the canvas height
 * went unused** (fillY 0.65; 0.49 at 1040×720, which is the empty band the owner's screenshot
 * shows).
 *
 * So the first slot is on the **vertical**, where the fit has room. That is a constant and
 * not a function of the box, and the measurement is why: the connected mass settles
 * consistently *wider* than the canvas it is drawn in, because the aspect-aware gravity is a
 * weak shaping term that under-corrects — 1.32 against a box of 1.25 at 1400×860, and 1.41
 * against a box of 1.00 at 1040×720. The slack is therefore vertical at every size measured,
 * and a rule that reads the box instead answered 1040×720 wrong by two pixels of box height.
 */
const ORPHAN_RING_PHASE = Math.PI / 2;

/**
 * **The picture is still once it has arrived.**
 *
 * ⚠️ This is where a ≤0.4px, 7.2s ambient drift used to be applied to every mark's screen
 * position, every fourth frame, forever. It was a bounded owner directive (2026-09-07,
 * *"it does not even move"*) and the owner reversed it on 2026-09-08 looking at the
 * installed app: *"why does it wriggle whenever I put the mouse on the graph? it is hard
 * to look at … get rid of that strange effect."* A drift small enough to be defensible in
 * a number was still large enough to be seen, and a picture that never stops moving is a
 * picture a person cannot rest their eye on while reading the document beside it.
 *
 * Nothing has replaced it. Motion here is now only ever the answer to something a person
 * did: the arrival, a drag, a release, a resize, a folder that changed. `docs/DECISIONS.md`,
 * 2026-09-08, carries the reversal.
 */

interface SimulationNode {
  id: string;
  kind: LibraryGraphNodeKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Collision half-extent: the drawn mark plus {@link COLLISION_PAD}. */
  radius: number;
  /** Set while a pointer holds this node. The integrator writes the position instead of the force. */
  fx: number | null;
  fy: number | null;
  /**
   * Arrival progress, 0 → 1. A node that has just appeared is faded in over
   * `--motion-base` by the caller; the simulation only counts, it does not draw.
   */
  entered: number;
  /** How many edges touch it — what the drawn radius is graded by. */
  degree: number;
  /**
   * Angle of this mark's slot on the orphan ring, or `null` when it has a relation and the
   * springs answer for it. Assigned from the sorted id, so it is the same on every machine
   * and the same on every visit.
   */
  orbit: number | null;
}

interface SimulationLink {
  source: number;
  target: number;
  rest: number;
  /** Split of each correction between the two ends, by relative degree. `d3-force`'s bias. */
  bias: number;
  strength: number;
}

export interface LibrarySimulation {
  nodes: SimulationNode[];
  index: Map<string, number>;
  links: SimulationLink[];
  alpha: number;
  alphaTarget: number;
  /** Half-width and half-height of the field, which is where the aspect-aware gravity comes from. */
  box: { width: number; height: number };
  /**
   * Order above which the many-body force switches to the Barnes–Hut tree.
   *
   * It is state rather than a constant **only so the perf test can measure both passes on
   * the same graph** — a crossover asserted against two different graphs is not a
   * crossover. Product code never sets it; `createLibrarySimulation` defaults it to
   * {@link MANY_BODY_EXACT_MAX_ORDER}.
   */
  exactMaxOrder: number;
  /** Ticks since creation. Only the tests read it. */
  ticks: number;
}

/** The drawn half-extent of a mark, graded by degree inside the 5–10px band. */
function markRadius(degree: number, maxDegree: number): number {
  if (maxDegree <= 0) return 5;
  // Square-rooted, so the band reads as "more links" rather than as a bar chart: area
  // grows with degree, which is how a person judges a dot's size.
  const t = Math.sqrt(Math.min(degree, maxDegree) / maxDegree);
  return 5 + 5 * t;
}

/** Every node's drawn half-extent, in one pass. Pure; the renderer takes the result. */
export function libraryMarkRadii(graph: LibraryGraph): Map<string, number> {
  const degree = new Map<string, number>();
  for (const node of graph.nodes) degree.set(node.id, 0);
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  let max = 0;
  for (const value of degree.values()) max = Math.max(max, value);
  const out = new Map<string, number>();
  for (const node of graph.nodes) {
    const radius = markRadius(degree.get(node.id) ?? 0, max);
    // A square reads heavier than a circle of the same extent, so a source keeps the
    // 5/6 step the renderer already used between them rather than matching by box.
    out.set(node.id, node.kind === "source" ? radius * (5 / 6) : radius);
  }
  return out;
}

/**
 * Builds the simulation. `box` is the canvas in CSS pixels; the simulation runs in the
 * same units, so a rest length is a distance a person can see.
 */
export function createLibrarySimulation({
  graph,
  box,
  exactMaxOrder = MANY_BODY_EXACT_MAX_ORDER,
}: {
  graph: LibraryGraph;
  box: { width: number; height: number };
  /** Measurement-only override; see {@link LibrarySimulation.exactMaxOrder}. */
  exactMaxOrder?: number;
}): LibrarySimulation {
  const ids = graph.nodes.map((node) => node.id);
  const seeds = seedPositions(ids);
  const radii = libraryMarkRadii(graph);
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const nodes: SimulationNode[] = graph.nodes.map((node) => {
    const seed = seeds.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      kind: node.kind,
      x: seed.x,
      y: seed.y,
      vx: 0,
      vy: 0,
      radius: (radii.get(node.id) ?? 5) + COLLISION_PAD,
      fx: null,
      fy: null,
      entered: 1,
      degree: degree.get(node.id) ?? 0,
      orbit: null,
    };
  });
  assignOrbits(nodes);
  const index = new Map(nodes.map((node, position) => [node.id, position]));
  return {
    nodes,
    index,
    links: buildLinks(graph, index, degree),
    alpha: 1,
    alphaTarget: 0,
    box: { width: Math.max(1, box.width), height: Math.max(1, box.height) },
    exactMaxOrder,
    ticks: 0,
  };
}

function buildLinks(
  graph: LibraryGraph,
  index: ReadonlyMap<string, number>,
  degree: ReadonlyMap<string, number>,
): SimulationLink[] {
  const links: SimulationLink[] = [];
  for (const edge of graph.edges) {
    const source = index.get(edge.source);
    const target = index.get(edge.target);
    if (source === undefined || target === undefined) continue;
    const sourceDegree = (degree.get(edge.source) ?? 0) + 1;
    const targetDegree = (degree.get(edge.target) ?? 0) + 1;
    links.push({
      source,
      target,
      rest: edge.relation === "cites" ? CITES_REST : MENTIONS_REST,
      // The busier end moves less. Without it a page cited by nothing else is dragged
      // across the canvas by a source that six other pages are also holding.
      bias: sourceDegree / (sourceDegree + targetDegree),
      /*
       * A hub's springs are weakened in proportion to how many it has, so a source every
       * page cites does not out-pull the whole picture into one knot. This is what
       * ForceAtlas2's `outboundAttractionDistribution` did for the settled layout, kept
       * because it was the reason a hub stayed reachable from all of its pages.
       */
      strength: 1 / Math.min(sourceDegree, targetDegree),
    });
  }
  return links;
}

/**
 * Hands every unattached mark its slot on the ring, and takes the slot back from every
 * mark that has a relation.
 *
 * **Evenly spread, in sorted-id order.** Even spacing is the whole of what makes four
 * loose files read as a composition rather than as four accidents; sorting by id is what
 * makes it the *same* composition on every machine and every visit, which is the property
 * the rest of this file pays for so carefully. The order is also the one a person can
 * predict — a folder's sources arrive together on the ring rather than interleaved with
 * its pages.
 *
 * Where the first slot sits is {@link ORPHAN_RING_PHASE}.
 */
function assignOrbits(nodes: SimulationNode[]): void {
  const loose: SimulationNode[] = [];
  for (const node of nodes) {
    node.orbit = null;
    if (node.degree === 0) loose.push(node);
  }
  if (loose.length === 0) return;
  loose.sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0));
  loose.forEach((node, position) => {
    node.orbit = ORPHAN_RING_PHASE + (position / loose.length) * Math.PI * 2;
  });
}

/**
 * **The ellipse the unattached marks stand on**, in the simulation's own units, or `null`
 * when the folder has none.
 *
 * Exported because it is the claim, not an implementation detail: a test asserting that an
 * orphan settled *in the band* has to be able to ask where the band is, and computing it a
 * second time in the test would only prove the test agrees with itself.
 *
 * Two things decide it. The **centre and the two standoffs** come from the connected mass,
 * measured per axis, so the ring stands off whatever the springs happened to build rather
 * than off the origin — and by {@link ORPHAN_RING_GAP} on both axes, never through it. The
 * **aspect** is the box's, for the reason the gravity is aspect-aware: a circle around a
 * wide canvas throws away its width, and because the ring is the outermost thing in the
 * picture its aspect is the picture's, so a fit that reserves the same padding on all four
 * sides fills both axes to that padding rather than one of them.
 *
 * ⚠️ **It is not clamped to the box, and that is deliberate.** The margin a person sees is
 * the fit's: it maps the whole picture into the canvas less {@link LIBRARY_LABEL_ALLOWANCE}
 * on every side, so the outermost mark is that far in whatever the world coordinates say. A
 * clamp could only bind on a canvas too small to hold the connected mass either, and there
 * the only thing it could buy would be pulling the loose marks *into* the cluster — the
 * defect, restated inward.
 */
export function libraryOrphanRing(
  sim: LibrarySimulation,
): { cx: number; cy: number; rx: number; ry: number } | null {
  let loose = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let held = 0;
  for (const node of sim.nodes) {
    if (node.orbit !== null) {
      loose += 1;
      continue;
    }
    minX = Math.min(minX, node.x - node.radius);
    minY = Math.min(minY, node.y - node.radius);
    maxX = Math.max(maxX, node.x + node.radius);
    maxY = Math.max(maxY, node.y + node.radius);
    held += 1;
  }
  if (loose === 0) return null;
  /*
   * ⚠️ **The centre is the mass's bounding box, not its centre of gravity** (2026-09-08).
   *
   * It used to be the centroid, with the radius taken as the *largest* distance from it to
   * any mark — and a cloud whose weight sits off-centre has one half-span much longer than
   * the other, so a symmetric radius around the centroid stands off the short side by the
   * long side's distance. Measured on the owner's folder at 1400×860: one loose mark whose
   * declared standoff is {@link ORPHAN_RING_GAP} (56) sat **185–225px** clear of the
   * connected mass — a quarter of the picture — which is both why it read as a stray and
   * why the fit had to shrink everything else to make room for it. Off the bounding box the
   * standoff is the number this file says it is.
   */
  const cx = held > 0 ? (minX + maxX) / 2 : 0;
  const cy = held > 0 ? (minY + maxY) / 2 : 0;
  const massX = held > 0 ? (maxX - minX) / 2 : 0;
  const massY = held > 0 ? (maxY - minY) / 2 : 0;
  const ratio = Math.min(4, Math.max(0.25, sim.box.width / sim.box.height));
  // The smaller radius decides, then the aspect gives the other one: solving it this way
  // round is what guarantees both standoffs at once, whichever axis the mass is long in.
  const ry = Math.max(
    massY + ORPHAN_RING_GAP,
    (massX + ORPHAN_RING_GAP) / ratio,
    ORPHAN_RING_MIN_RADIUS / Math.sqrt(ratio),
  );
  return { cx, cy, rx: ry * ratio, ry };
}

/**
 * Pulls each unattached mark toward its own slot instead of toward the centre.
 *
 * It is a force like every other one here, scaled by alpha and answered by repulsion and
 * collision, so a settled orphan sits *near* its slot rather than *at* it, a dragged one
 * leaves it, and a released one comes home. Freezing them on the ellipse would have been
 * fewer lines and would have made four of the marks on a live canvas dead.
 */
function applyOrphanRing(sim: LibrarySimulation, alpha: number): void {
  const ring = libraryOrphanRing(sim);
  if (!ring) return;
  const strength = ORPHAN_RING_GRAVITY * alpha;
  for (const node of sim.nodes) {
    if (node.orbit === null) continue;
    node.vx += (ring.cx + Math.cos(node.orbit) * ring.rx - node.x) * strength;
    node.vy += (ring.cy + Math.sin(node.orbit) * ring.ry - node.y) * strength;
  }
}

/**
 * One tick.
 *
 * Velocity Verlet in the form `d3-force` uses: forces accumulate into velocity, velocity
 * is damped, position integrates velocity. A pinned node has its position written
 * directly and its velocity zeroed, so the picture it drags is the picture the forces
 * make around a fixed point rather than a fight between the pointer and a spring.
 */
export function stepLibrarySimulation(sim: LibrarySimulation): LibrarySimulation {
  sim.alpha += (sim.alphaTarget - sim.alpha) * ALPHA_DECAY;
  const { alpha, nodes } = sim;
  sim.ticks += 1;

  applyManyBody(sim, alpha);
  applyGravity(sim, alpha);
  applyOrphanRing(sim, alpha);
  for (let pass = 0; pass < RELAX_PASSES; pass += 1) {
    applyLinks(sim, alpha / RELAX_PASSES);
    applyCollisions(sim);
  }

  for (const node of nodes) {
    if (node.entered < 1) node.entered = Math.min(1, node.entered + 0.08);
    if (node.fx !== null && node.fy !== null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx *= VELOCITY_DECAY;
    node.vy *= VELOCITY_DECAY;
    node.x += node.vx;
    node.y += node.vy;
    // Repulsion alone can push a node in its own component to a non-finite coordinate.
    // Putting it back at the centre keeps the fit from collapsing to one point, which is
    // what the old layout's own finite-check was there to prevent.
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      node.x = 0;
      node.y = 0;
      node.vx = 0;
      node.vy = 0;
    }
  }
  return sim;
}

/**
 * ⚠️ **An unattached mark takes no part in this force**, in either pass.
 *
 * Repulsion is what threw the loose marks at the walls: it falls off as 1/d, so seven
 * marks 300 units away still push about 6 units per tick, and the only thing that was
 * answering was a gravity aimed at a centre the mark was already 300 units from. Nothing
 * in the folder said where it should be, so the picture said "far away, in whichever
 * direction it started". The ring says it instead, and saying it twice — a slot and a
 * shove — leaves the mark at whichever offset the two happen to cancel at, which is not a
 * place either.
 *
 * What repulsion exists for is still paid: collision keeps every mark off every other one,
 * and the ring stands the whole set clear of the mass by {@link ORPHAN_RING_GAP}. What is
 * given up is orphans nudging the connected picture around, which is a good trade —
 * a folder's real layout should not depend on how many files nobody cited.
 */
function applyManyBody(sim: LibrarySimulation, alpha: number): void {
  const { nodes } = sim;
  const charge = MANY_BODY_STRENGTH * alpha;
  /*
   * The orphans are taken out **once**, not tested inside the pair loop: a branch in there
   * runs n²/2 times, and adding one to it measured the 200-node exact pass at 0.62ms
   * against 0.35 (2026-09-07, the perf test's own crossover case, which is exactly why
   * that gate is stated as a comparison rather than a wall-clock ceiling). The copy is a
   * list of references, made only on a folder that has an orphan at all.
   */
  const held = nodes.some((node) => node.orbit !== null)
    ? nodes.filter((node) => node.orbit === null)
    : nodes;
  if (held.length === 0) return;
  if (held.length > sim.exactMaxOrder) {
    const tree = new LibraryQuadtree(held);
    const out = { fx: 0, fy: 0 };
    for (const node of held) {
      out.fx = 0;
      out.fy = 0;
      tree.accumulate(node.x, node.y, charge, out);
      node.vx += out.fx;
      node.vy += out.fy;
    }
    return;
  }
  for (let a = 0; a < held.length; a += 1) {
    const first = held[a]!;
    for (let b = a + 1; b < held.length; b += 1) {
      const second = held[b]!;
      let dx = second.x - first.x;
      let dy = second.y - first.y;
      let distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < 1e-6) {
        // Two marks exactly on top of each other, separated along a fixed diagonal so
        // the same folder resolves the same way every time.
        dx = 1e-3;
        dy = 1e-3;
        distanceSquared = 2e-6;
      }
      const weight = charge / distanceSquared;
      const fx = dx * weight;
      const fy = dy * weight;
      first.vx += fx;
      first.vy += fy;
      second.vx -= fx;
      second.vy -= fy;
    }
  }
}

/**
 * Gravity toward the centre, **stronger across the short axis of the box than along its
 * long one** — the force that lets a wide canvas be filled without a non-uniform fit.
 *
 * The two strengths are the box's aspect split around 1, so their product is the plain
 * `GRAVITY`: a square box is the isotropic case and nothing about the picture changes
 * from what a standard force layout would produce.
 *
 * ⚠️ **This is a weak shaping term, and a 2026-09-08 experiment measured how weak.** With
 * one loose mark standing off the mass, the picture's aspect is the mass's plus that rim,
 * so a mass shaped to the box's aspect always overshoots it. Feeding the gravity a
 * rim-corrected aspect — solve `massW / (massH + rim) = boxAspect` — asked for 1.87 where
 * the box says 1.25 and moved the settled mass from 1.32 to **1.35**: the springs and the
 * repulsion decide the shape, and gravity only leans on it. It bought 2% of canvas width
 * and cost a feedback term, so it is not here. If the picture ever needs a stronger opinion
 * about its own aspect, the lever is the link rest lengths, not this.
 */
function applyGravity(sim: LibrarySimulation, alpha: number): void {
  const aspect = sim.box.width / sim.box.height;
  const skew = Math.sqrt(Math.min(4, Math.max(0.25, aspect)));
  const strengthX = (GRAVITY / skew) * alpha;
  const strengthY = GRAVITY * skew * alpha;
  for (const node of sim.nodes) {
    // An unattached mark answers to its ring slot instead; two centres would fight.
    if (node.orbit !== null) continue;
    node.vx -= node.x * strengthX;
    node.vy -= node.y * strengthY;
  }
}

function applyLinks(sim: LibrarySimulation, alpha: number): void {
  const { nodes, links } = sim;
  for (const link of links) {
    const source = nodes[link.source]!;
    const target = nodes[link.target]!;
    let dx = target.x + target.vx - (source.x + source.vx);
    let dy = target.y + target.vy - (source.y + source.vy);
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 1e-6) {
      dx = 1e-3;
      dy = 0;
      distance = 1e-3;
    }
    const correction = ((distance - link.rest) / distance) * alpha * link.strength;
    const x = dx * correction;
    const y = dy * correction;
    target.vx -= x * link.bias;
    target.vy -= y * link.bias;
    source.vx += x * (1 - link.bias);
    source.vy += y * (1 - link.bias);
  }
}

/**
 * No mark ever sits on another mark.
 *
 * Two passes, and which one runs is decided by order. Below
 * {@link COLLISION_EXACT_MAX_ORDER} every pair is tested, which is two multiplies per
 * pair and cheaper than building anything. Above it the nodes are binned into a uniform
 * grid whose cell is one collision diameter, so each node tests only its own cell and the
 * eight around it — the pairs that could possibly be touching.
 *
 * ⚠️ **This is the pass that decided the frame budget, not the many-body force.** Measured
 * before the grid existed: one tick of a 1,500-node folder took 13.7 ms, of which the
 * exact collision pass was over 11 — the quadtree was saving tenths of a millisecond on a
 * force that was not the problem. A grid here is the change that put 1,500 nodes back
 * inside a frame.
 */
function applyCollisions(sim: LibrarySimulation): void {
  const { nodes } = sim;
  if (nodes.length <= COLLISION_EXACT_MAX_ORDER) {
    for (let a = 0; a < nodes.length; a += 1) {
      const first = nodes[a]!;
      for (let b = a + 1; b < nodes.length; b += 1) resolveCollision(first, nodes[b]!);
    }
    return;
  }
  let cell = 0;
  for (const node of nodes) cell = Math.max(cell, node.radius);
  cell *= 2;
  const bins = new Map<number, number[]>();
  const columns = 1 << 16;
  const keyOf = (node: SimulationNode): number =>
    (Math.floor((node.y + node.vy) / cell) + 32768) * columns + (Math.floor((node.x + node.vx) / cell) + 32768);
  for (let index = 0; index < nodes.length; index += 1) {
    const key = keyOf(nodes[index]!);
    const bin = bins.get(key);
    if (bin) bin.push(index);
    else bins.set(key, [index]);
  }
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!;
    const column = Math.floor((node.x + node.vx) / cell) + 32768;
    const row = Math.floor((node.y + node.vy) / cell) + 32768;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bin = bins.get((row + dy) * columns + (column + dx));
        if (!bin) continue;
        // Each pair once: the higher index always defers to the lower one.
        for (const other of bin) if (other > index) resolveCollision(node, nodes[other]!);
      }
    }
  }
}

function resolveCollision(first: SimulationNode, second: SimulationNode): void {
  const reach = first.radius + second.radius;
  let dx = second.x + second.vx - (first.x + first.vx);
  let dy = second.y + second.vy - (first.y + first.vy);
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= reach * reach) return;
  let distance = Math.sqrt(distanceSquared);
  if (distance < 1e-6) {
    dx = 1e-3;
    dy = 1e-3;
    distance = Math.SQRT2 * 1e-3;
  }
  const push = ((reach - distance) / distance) * 0.5;
  const x = dx * push;
  const y = dy * push;
  second.vx += x;
  second.vy += y;
  first.vx -= x;
  first.vy -= y;
}

/** Puts energy back in — a drag, a resize, or a folder that gained a file. */
export function reheatLibrarySimulation(sim: LibrarySimulation, alpha = REHEAT_ALPHA): void {
  sim.alpha = Math.max(sim.alpha, alpha);
}

/** Whether the picture still has anywhere to go. The rAF loop stops when this is false. */
export function isLibrarySimulationRunning(sim: LibrarySimulation): boolean {
  if (sim.alpha > ALPHA_MIN) return true;
  return sim.nodes.some((node) => node.fx !== null);
}

/**
 * Runs the simulation to rest in one call.
 *
 * This is the **reduced-motion path**, and the tests'. Under
 * `prefers-reduced-motion: reduce` nothing is animated: the settled picture is computed
 * here and drawn once, which is the same answer the one-shot layout gave and the reason
 * that preference loses nothing but the motion.
 */
export function settleLibrarySimulation(sim: LibrarySimulation, maxTicks = 400): LibrarySimulation {
  for (let tick = 0; tick < maxTicks; tick += 1) {
    stepLibrarySimulation(sim);
    if (!isLibrarySimulationRunning(sim)) break;
  }
  for (const node of sim.nodes) node.entered = 1;
  return sim;
}

/** Holds a node under the pointer. The forces keep running around it. */
export function pinLibraryNode(sim: LibrarySimulation, id: string, point: LayoutPoint): void {
  const node = sim.nodes[sim.index.get(id) ?? -1];
  if (!node) return;
  node.fx = point.x;
  node.fy = point.y;
}

/**
 * Lets go, handing the node the velocity it was being moved at.
 *
 * A node released dead-still stops as if it had hit a wall; the short inertia is what
 * makes the picture feel like it has mass. It is capped, because a fast flick would
 * otherwise throw a node clear of the canvas before the springs could answer.
 */
export function releaseLibraryNode(
  sim: LibrarySimulation,
  id: string,
  velocity?: LayoutPoint,
): void {
  const node = sim.nodes[sim.index.get(id) ?? -1];
  if (!node) return;
  node.fx = null;
  node.fy = null;
  if (velocity) {
    const speed = Math.hypot(velocity.x, velocity.y);
    const cap = speed > 14 ? 14 / speed : 1;
    node.vx = velocity.x * cap;
    node.vy = velocity.y * cap;
  }
}

/** Whether any node is currently held. */
export function hasPinnedNode(sim: LibrarySimulation): boolean {
  return sim.nodes.some((node) => node.fx !== null);
}

/**
 * Re-fits the field when the canvas changes shape. The positions are kept — a resize is
 * not a new picture — but the gravity's aspect is, so the cloud stretches into the new
 * box instead of staying in the shape of the old one.
 */
export function resizeLibrarySimulation(
  sim: LibrarySimulation,
  box: { width: number; height: number },
): void {
  const width = Math.max(1, box.width);
  const height = Math.max(1, box.height);
  if (sim.box.width === width && sim.box.height === height) return;
  sim.box = { width, height };
  reheatLibrarySimulation(sim, 0.2);
}

/**
 * **A folder that changed rearranges, it does not jump.**
 *
 * Nodes that are still there keep their positions and their velocities. A new node
 * enters at the position of a neighbour it is already attached to — a page Compile has
 * just written appears **on its sources**, and is then pushed out to its own place by
 * the same forces that hold everybody else — rather than at a seed on a ring nowhere
 * near where it belongs. Removed nodes are handed back so the caller can fade them over
 * `--motion-base` instead of deleting them mid-frame.
 */
export function syncLibrarySimulation(
  sim: LibrarySimulation,
  graph: LibraryGraph,
): { entered: string[]; removed: Array<{ id: string; x: number; y: number }> } {
  const wanted = new Set(graph.nodes.map((node) => node.id));
  const removed: Array<{ id: string; x: number; y: number }> = [];
  const kept: SimulationNode[] = [];
  for (const node of sim.nodes) {
    if (wanted.has(node.id)) kept.push(node);
    else removed.push({ id: node.id, x: node.x, y: node.y });
  }

  const byId = new Map(kept.map((node) => [node.id, node]));
  const neighbours = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    const list = neighbours.get(from);
    if (list) list.push(to);
    else neighbours.set(from, [to]);
  };
  for (const edge of graph.edges) {
    link(edge.source, edge.target);
    link(edge.target, edge.source);
  }

  const radii = libraryMarkRadii(graph);
  const degree = new Map<string, number>();
  for (const edge of graph.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  const seeds = seedPositions(graph.nodes.map((node) => node.id));
  const entered: string[] = [];
  const nodes: SimulationNode[] = graph.nodes.map((node) => {
    const existing = byId.get(node.id);
    if (existing) {
      existing.radius = (radii.get(node.id) ?? 5) + COLLISION_PAD;
      existing.degree = degree.get(node.id) ?? 0;
      return existing;
    }
    entered.push(node.id);
    // Whichever attached neighbour is already on the canvas; the graph's own edge order
    // decides, so an arrival is as reproducible as everything else here.
    const anchor = (neighbours.get(node.id) ?? []).map((id) => byId.get(id)).find(Boolean);
    const seed = seeds.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      kind: node.kind,
      x: anchor ? anchor.x : seed.x,
      y: anchor ? anchor.y : seed.y,
      vx: 0,
      vy: 0,
      radius: (radii.get(node.id) ?? 5) + COLLISION_PAD,
      fx: null,
      fy: null,
      entered: 0,
      degree: degree.get(node.id) ?? 0,
      orbit: null,
    };
  });
  // A page that just gained its first citation stops being an orphan, and one whose last
  // source was deleted becomes one: the ring is re-derived from the new degrees, never
  // carried over.
  assignOrbits(nodes);

  sim.nodes = nodes;
  sim.index = new Map(nodes.map((node, position) => [node.id, position]));
  sim.links = buildLinks(graph, sim.index, degree);
  if (entered.length > 0 || removed.length > 0) reheatLibrarySimulation(sim);
  return { entered, removed };
}

/** Where each node is, in the simulation's own units. */
export function libraryPositions(sim: LibrarySimulation): Map<string, LayoutPoint> {
  const out = new Map<string, LayoutPoint>();
  for (const node of sim.nodes) out.set(node.id, { x: node.x, y: node.y });
  return out;
}

/** The picture's own extent, for the fit. */
export function librarySimulationBounds(
  sim: LibrarySimulation,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (sim.nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of sim.nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  return { minX, minY, maxX, maxY };
}
