---
slug: project
kind: project
title: My project
domains:
  - domains/example
capabilities:
  - capabilities/example
elements:
  - elements/example
---

# My project

여기서 프로젝트의 한두 줄 요약을 적습니다 — *"무엇을 / 누구에게 / 왜"*.

## 한 줄 mission

이 프로젝트가 해결하는 문제 / 만드는 가치를 한 줄로.

## 어떻게 자라는가

- frontmatter 의 `domains: [...]` 를 채우면 도메인 노드가 트리에 매달립니다.
- 각 도메인 안 capability / element 도 같은 패턴.
- AI agent 가 새 노드를 만들 때 이 파일의 `depends_on` / `domains` 가
  자동 갱신될 수 있어요 — frontmatter 가 진실원이라 충돌 안 납니다.

## 다음 단계

1. 이 파일의 `title` 과 `kind: project` 외 frontmatter 를 본인 프로젝트에 맞게 수정
2. `domains/example.md` 같은 starter 를 본인 영역으로 rename / 복제
3. AI agent (Claude Code 등) 등록 후 "이 vault 의 ontology 좀 정리해줘" 라고 요청
