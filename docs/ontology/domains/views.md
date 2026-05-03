---
slug: domains/views
kind: domain
title: Views (Topology · Browse · Builder)
capabilities:
  - topology-sigma-render
  - ontology-hub-mode-aware
  - builder-vault-write
elements:
  - src/views/home
  - src/views/ontology-view
  - src/views/ontology-edit
  - src/widgets/topology-map-sigma
  - src/widgets/global-search
relates:
  - domains/ontology-core
---

# Views

같은 ontology 그래프의 세 출구. 토폴로지 (Sigma + ForceAtlas2 spatial network),
둘러보기 (`/ontology` 트리 계층 + ego graph + 노드 detail), 빌더 (xyflow ERD
canvas + md 내보내기). 검색 — `⌘K` 프로젝트 / `⇧⌘K` 노드+프로젝트 통합.
