---
slug: domains/example
kind: domain
title: 예시 도메인
capabilities:
  - capabilities/example
---

# 예시 도메인

도메인 = 프로젝트의 큰 영역 (인증·결제·빌더·실시간·검색 같은 하위 시스템).
이 파일을 본인 도메인 이름으로 rename 하고 (`domains/auth.md`,
`domains/billing.md` 등) 그 도메인이 가진 capability 를 위 frontmatter
`capabilities:` 에 적어주세요.

## 어떻게 채우나

- 한두 단락의 본문은 *그 도메인이 무엇인지* 설명.
- 본문에 다른 도메인 / capability 의 markdown link 를 넣으면 backlink
  로 인식됩니다.
- frontmatter 키:
  - `capabilities: [...]` — 이 도메인이 가진 역량 slug 들
  - `depends_on: [...]` — 이 도메인이 의존하는 다른 도메인 / 외부 시스템
  - `evidenceIds: [...]` — 이 노드의 근거 문서 ID (선택)

## 살릴까 지울까

- 살릴 거면 위 가이드대로 채우기
- 안 쓸 거면 이 파일 삭제 — 그냥 starter 입니다
