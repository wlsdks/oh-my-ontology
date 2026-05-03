---
slug: domains/ontology-core
kind: domain
title: Ontology Core (TBox · ABox · Evidence)
capabilities:
  - frontmatter-to-ontology
elements:
  - src/entities/ontology-class
  - src/entities/knowledge-graph
  - src/entities/docs-vault/lib/derive-ontology-from-vault
relates:
  - domains/vault-local-first
  - domains/views
---

# Ontology Core

4-layer class hierarchy (Project · Domain · Capability · Element + Document) +
7 edge types (KNOWLEDGE_EDGE_TYPES) + evidence-grounded statements. Vault
frontmatter is the single source of truth — derive-ontology-from-vault turns
\`.md\` frontmatter into the in-memory graph. Architecture overview:
\`docs/ARCHITECTURE.md\`.
