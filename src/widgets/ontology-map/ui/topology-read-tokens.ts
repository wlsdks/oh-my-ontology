/**
 * Shared `getOntologyMapTokens()` wrapper for the UI layer — swallows
 * `OntologyMapTokenError` into a console error + `null` so per-frame/per-event
 * callers can bail out safely on token drift instead of crashing the canvas.
 */

import { getOntologyMapTokens, OntologyMapTokenError, type OntologyMapTokens } from "../tokens/read-map-tokens";

// Re-review friction E — the same drift message is not printed every frame. An early
// read right after a remount, before CSS applies, was demonstrated to produce 1,200+
// messages of spam per session. One log per distinct message — a new kind of drift is
// still visible.
const loggedDriftMessages = new Set<string>();

export function readOntologyMapTokensOrNull(): OntologyMapTokens | null {
  try {
    return getOntologyMapTokens();
  } catch (err) {
    if (err instanceof OntologyMapTokenError && !loggedDriftMessages.has(err.message)) {
      loggedDriftMessages.add(err.message);
      console.error("[ontology-map] token drift:", err.message);
    }
    return null;
  }
}
