---
slug: elements/example
kind: element
title: Example element
domain: domains/example
---

# Example element

An *element* is a smaller unit a capability uses (jwt-token, otp-store,
indexeddb-adapter, sigma-canvas, …). Rename this file to match a real
element (`elements/jwt-token.md`) and set `domain:` to the right parent.

## How to fill it in

- One or two paragraphs in the body covering *what / why / which interface*.
- Frontmatter keys:
  - `domain: <slug>` — the single parent domain
  - `depends_on: [...]` — other elements / capabilities this depends on
  - `evidenceIds: [...]` — library docs or decision document IDs (optional)
