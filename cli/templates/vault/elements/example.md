---
slug: elements/example
kind: element
title: 예시 요소
domain: domains/example
---

# 예시 요소

Element = capability 가 쓰는 더 작은 단위 (jwt-token, otp-store,
indexeddb-adapter, sigma-canvas, …). 이 파일을 본인 element 이름으로
rename 하고 (`elements/jwt-token.md`) 위 frontmatter `domain:` 을
정확한 도메인으로 적어주세요.

## 어떻게 채우나

- 본문은 *무엇을 / 왜 / 어떤 인터페이스* 한두 단락.
- frontmatter 키:
  - `domain: <slug>` — 상위 도메인 한 개
  - `depends_on: [...]` — 다른 element / capability 에 의존하면
  - `evidenceIds: [...]` — 라이브러리 docs / 결정 문서 ID (선택)
