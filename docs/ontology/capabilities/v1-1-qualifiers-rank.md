---
slug: capabilities/v1-1-qualifiers-rank
kind: capability
title: V1.1 — Statement Qualifiers + Rank (Wikidata 영감)
domain: ontology-core
elements: [src/entities/knowledge-graph/model/types.ts, src/entities/knowledge-graph/model/mapper.ts, functions/index.js]
---

# V1.1 — Statement Qualifiers + Rank

Wikidata 의 statement annotation 모델을 ontology edge 에 도입. additive (breakage 0), 마이그레이션 0, TBox 변경 0.

## 추가 필드 (옵셔널)

- `qualifiers?: { propertyId: string; value: QualifierValue }[]` — edge 의 한정자
- `rank?: "preferred" | "normal" | "deprecated"` — 같은 (from, to, type) 다중 statement 우선순위

## QualifierValue union

- `{ kind: "string"; raw: string }`
- `{ kind: "time"; iso: string; precision: "year" | "month" | "day" }`
- `{ kind: "quantity"; value: number; unit?: string }`
- `{ kind: "nodeRef"; nodeId: string }`

## 호환성

legacy edge: `qualifiers` 없음 + `rank` undefined → 코드는 `rank ?? "normal"` 폴백. mapper 가 invalid 항목 silently drop.

## 구현 위치

- types.ts — QualifierValue / EdgeQualifier / EdgeRank + KnowledgeGraphEdge 확장
- mapper.ts — fromFirestoreKnowledgeGraphEdge 가 fields 인식 + invalid 폴백
- functions/index.js publishKnowledgeProjectionCore — approved → public projection 시 qualifiers + rank fields-pass-through

자세히: docs/ONTOLOGY-MODEL-V2-DRAFT.md §2.
