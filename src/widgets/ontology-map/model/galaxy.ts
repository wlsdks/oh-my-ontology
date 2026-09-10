/**
 * **The constellation tier, made literal — the map seen from far enough away is a galaxy.**
 *
 * The owner, 2026-09-10: *"it'd be nice to have something like a galaxy mode, where things look
 * completely like stars, in 2D..! totally like a galaxy."* Of the three shapes put up for that,
 * the chosen one was **altitude, not a toggle**: no new control, no new mode, no second screen
 * to keep in sync. Zoom out and the workbench becomes a galaxy; zoom in and it is the workbench
 * again.
 *
 * That direction was not invented for the request — it was already half-built and unnamed.
 * `model/altitude.ts` has classified this canvas into `circuit → transitioning →
 * **constellation**` since it was written, `render/starfield.ts` paints far-field dust under a
 * header naming the language ("B1 constellation DNA"), and node shapes already converge to
 * circles as `farT` rises. What the top tier never did was *become* the thing it was called.
 * This module is that tier's own vocabulary.
 *
 * ## What each mark says up there
 *
 * | Near (`circuit`) | Far (`constellation`) | The fact |
 * |---|---|---|
 * | hexagon / square / circle | a round point of light | kind — the silhouette has converged, so |
 * | kind colour on the stroke | **colour temperature** | …kind moves to a channel distance keeps |
 * | radius by child count | radius by child count (unchanged) | how much it contains |
 * | — | **brightness** | how connected it is |
 * | dashed / solid relation | a faint filament | that a relation exists |
 *
 * Nothing here invents a fact. Brightness is the *continuous* form of the magnitude this map has
 * always ranked its bright stars by (`size + fullDegree * 18`, ported from the prototype); the
 * only change is that every node gets its own value instead of the top `starCount` getting a
 * diffraction cross and everyone else getting nothing.
 *
 * ## Why the maths is here and not in the draw
 *
 * Same contract as the map's other expressive folders: plain numbers in, plain numbers out, no
 * canvas, no React, no clock, no tokens. Every value below is decidable from a node and a
 * camera altitude, so the galaxy is testable without a GPU and the frame draw is left owning
 * nothing but paint.
 */

import type { WorldNodeKind } from "../ui/topology-world";

/**
 * Where the galaxy begins and where it is complete, on the `farT` altitude axis.
 *
 * `classifyAltitudeTier` calls everything above 0.85 "constellation" and everything below 0.15
 * "circuit". The ramp deliberately starts **inside the transition** rather than at the tier
 * boundary: a change that waited for 0.85 would arrive as a switch flipping, and the whole point
 * of choosing altitude over a toggle was that there is no flip. By the time the chip says
 * "constellation" the sky is already there.
 *
 * It ends at 0.97 rather than 1 because `farT` reaches 1 only at the very top of the zoom-out
 * range; a galaxy that is only complete at the last pixel of travel is a galaxy nobody sees.
 */
export const GALAXY_ENTER_FAR_T = 0.55;
export const GALAXY_FULL_FAR_T = 0.97;

/** How present the galaxy is at this altitude, 0 (workbench) to 1 (sky). */
export function galaxyRamp(farT: number): number {
  if (!Number.isFinite(farT)) return 0;
  const t = (farT - GALAXY_ENTER_FAR_T) / (GALAXY_FULL_FAR_T - GALAXY_ENTER_FAR_T);
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  // Smoothstep, so the sky arrives and settles rather than sliding in at a constant rate — the
  // same curve the rest of this canvas uses for altitude-driven change.
  return u * u * (3 - 2 * u);
}

/**
 * A node's magnitude, 0–1, from the two numbers this map has always ranked stars by.
 *
 * `size + fullDegree * 18` is not a new formula: it is the one `topology-world.ts` already sorts
 * by to pick which nodes wear a diffraction cross, ported from the prototype. Normalising it
 * instead of taking the top N is the whole difference between "twelve nodes are special" and "a
 * sky has magnitudes".
 *
 * The square root is Stevens' law doing its job: perceived brightness grows more slowly than
 * luminance, so a linear map would make a hub of degree 40 look barely brighter than one of
 * degree 20 while crushing everything below degree 5 into the same dark. It is the same reason
 * `computeMagnitudeScale` takes the root of child count for radius.
 */
export function starMagnitude(size: number, fullDegree: number, maxRaw: number): number {
  const raw = Math.max(0, (Number.isFinite(size) ? size : 0) + Math.max(0, fullDegree) * 18);
  const ceiling = Math.max(1, maxRaw);
  return Math.sqrt(Math.min(1, raw / ceiling));
}

/**
 * How brightly a node of this magnitude burns, 0–1.
 *
 * ⚠️ **The floor is the whole argument.** A galaxy whose faint stars reach zero is not a galaxy,
 * it is a few bright nodes on an empty field — and worse, it would be a lie: a node that exists
 * and connects to nothing is still there, and the overview's job is to show what you have. The
 * floor is what keeps a leaf element visible while still letting a hub outshine it, and the
 * range above it is what carries the fact.
 */
export const GALAXY_DIM_FLOOR = 0.3;

export function starLuminance(magnitude: number): number {
  const m = Number.isFinite(magnitude) ? Math.min(1, Math.max(0, magnitude)) : 0;
  return GALAXY_DIM_FLOOR + (1 - GALAXY_DIM_FLOOR) * m;
}

/**
 * Kind → the colour-temperature step that carries it once the silhouette is gone.
 *
 * ⚠️ **This is not kind changing channel on a whim — it is kind keeping its channel after the
 * old one melts.** Near the ground, kind is a *shape*: a hexagon is a project, a square a
 * domain. `interpolateCornerRadius` rounds those corners off as altitude rises and
 * `FULL_CIRCLE_FAR_T` finishes the job, so at the top every node is the same circle and the
 * shape channel is simply gone. Temperature picks it back up.
 *
 * The ramp runs warm to cool **down the containment ladder** — project, domain, capability,
 * element — so the temperature is not an arbitrary lookup but a reading of depth: the thing that
 * contains everything is the warm centre, and the leaves are the cool rim. Colour is never the
 * only carrier: radius still says how much a node contains, so a project remains the largest
 * mark on the field for a reader who cannot separate the hues at all.
 */
export const GALAXY_TEMPERATURE_ORDER: readonly WorldNodeKind[] = [
  "project",
  "domain",
  "capability",
  "element",
];

/** The token key whose value paints a node of this kind at galaxy altitude. */
export function galaxyTemperatureKey(
  kind: WorldNodeKind,
): "galaxyProject" | "galaxyDomain" | "galaxyCapability" | "galaxyElement" {
  switch (kind) {
    case "project":
      return "galaxyProject";
    case "domain":
      return "galaxyDomain";
    case "capability":
      return "galaxyCapability";
    default:
      return "galaxyElement";
  }
}

/**
 * How much of the node's ordinary body survives at this galaxy level.
 *
 * A star has no fill and no outline; it is light. But the body cannot simply be switched off,
 * because the ramp is continuous and a body that vanished at some threshold would put the flip
 * back that choosing altitude removed. It fades, and it fades **faster than the light arrives**
 * — the exponent — so there is no altitude at which a node is both a solid shape and a bright
 * star, which is the frame that would read as a bug.
 */
export function bodyPresence(galaxy: number): number {
  const g = Number.isFinite(galaxy) ? Math.min(1, Math.max(0, galaxy)) : 0;
  const remaining = 1 - g;
  return remaining * remaining;
}

/**
 * How much of a relation's ink survives at this galaxy level.
 *
 * Relations do not disappear — a galaxy with no structure between its stars is a scatter plot,
 * and the structure is the thing Atlas is for. They thin to filaments: enough to read the shape
 * of the graph as gas between the stars, not enough to compete with the stars themselves. It
 * never reaches zero, and it is floored well above the point where a line stops being visible on
 * this canvas at all.
 */
export const GALAXY_FILAMENT_FLOOR = 0.34;

export function filamentPresence(galaxy: number): number {
  const g = Number.isFinite(galaxy) ? Math.min(1, Math.max(0, galaxy)) : 0;
  return 1 - (1 - GALAXY_FILAMENT_FLOOR) * g;
}
