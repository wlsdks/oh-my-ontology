---
slug: capabilities/frontmatter-to-ontology
kind: capability
title: Frontmatter → Ontology Stub
domain: ontology-core
elements:
  - src/shared/lib/parse-frontmatter
  - src/entities/docs-vault/lib/derive-ontology-from-vault
relates:
  - domains/vault-local-first
  - domains/ontology-core
---

# Frontmatter → Ontology Stub

vault 의 `.md` 파일 frontmatter 를 직접 읽어 OntologyStub (nodes + edges + warnings) 으로
변환. AI 추출 / 검수 큐 거치지 않는 fast-path. 이게 mission "frontmatter 가 자기-승인" 의 코드 표현.

지원 frontmatter 키:
- `kind:` — canonical 5: project / domain / capability / element / document
- `title:`, `domain:`
- `capabilities: []`, `elements: []` — 배열 노드
- `relates: []`, `dependencies: []` — edge 후보

scripts/build-docs-vault.mjs 와 src/shared/lib/parse-frontmatter.ts 가 capability 동기화.
