---
slug: domains/mode-aware-adapters
kind: domain
title: Mode-Aware Adapters
capabilities:
  - data-source-dispatch
  - mode-aware-read
  - mode-aware-mutation
  - taxonomy-mode-bridge
elements:
  - src/features/data-source-mode
  - src/features/project-data-source
relates:
  - domains/vault-local-first
  - domains/ontology-core
---

# Mode-Aware Adapters

`useDataSourceMode()` 가 local / static 분기 결정. R10 (auth + cloud surface
영구 제거) 이후 두 mode 만 존재. 같은 hook 호출이 mode 별로 다른 source 를 본다 —
사용자에겐 단일 UX.

미래 cloud collab 단계가 다시 도입될 때 `'cloud'` mode 와 그 adapter 를 새로 추가.
