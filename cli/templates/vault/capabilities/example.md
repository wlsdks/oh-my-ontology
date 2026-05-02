---
slug: capabilities/example
kind: capability
title: 예시 역량
domain: domains/example
elements:
  - elements/example
---

# 예시 역량

Capability = 도메인의 한 사용자-가시 기능 단위 (로그인, 회원가입, 결제,
검색, 빌더 캔버스 등). 이 파일을 본인 역량 이름으로 rename 하고
(`capabilities/login.md`, `capabilities/checkout.md`) 위 frontmatter
`domain:` 과 `elements:` 를 본인 환경에 맞게 적어주세요.

## 어떻게 채우나

- 본문에 *이 capability 가 무엇을 하는지* + 사용자 시나리오 한두 줄.
- frontmatter 키:
  - `domain: <slug>` — 상위 도메인 한 개
  - `elements: [...]` — 이 capability 가 사용하는 element slug 들
  - `depends_on: [...]` — 다른 capability 에 의존하면
  - `evidenceIds: [...]` — 명세 / 결정문서 ID (선택)
