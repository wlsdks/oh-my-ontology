# oh-my-ontology — Cloud Functions

Knowledge subsystem trusted worker · publish backend. Firebase 2nd gen
(asia-northeast3).

> **Mission v2 정렬 (2026-05-01)**: cloud LLM extraction 흐름 (Gemini /
> Claude) 은 제거됨. AI 추출은 사용자 측 AI agent partner (Claude Code 등)
> 가 MCP 서버로 직접 ontology 를 read/write 한다 — `mcp/` 패키지 참고.

## 남아있는 callable functions

| 이름 | 트리거 | 용도 |
|---|---|---|
| `applyReviewAction` | onCall | 검수자가 추출 결과 (legacy `knowledgeExtractionOutputs`) 를 부분 / 전체 승인. cloud 모드 review 큐 surface 에서 사용 |
| `promoteStubNode` | onCall | 미해결 stub 노드를 정식 노드로 승격 (kind 부여) |
| `dismissStubNode` | onCall | 미해결 stub 노드 폐기 |
| `publishKnowledgeProjection` | onCall | private canonical → public projection 동기화 |

모두 Firestore admin 화이트리스트 (`admins/{email}`) 권한 게이트.

## 배포

```bash
firebase deploy --only functions
```

특정 함수만:

```bash
firebase deploy --only functions:applyReviewAction
```

## 로컬 emulator

```bash
firebase emulators:start --only functions,firestore
```

`@google-cloud/functions-framework` 가 dev 의존성으로 들어있어 standalone
실행도 가능 — `node node_modules/@google-cloud/functions-framework/build/main.js
--target=applyReviewAction`.

## 디버깅

- `applyReviewAction` 실패 시 `knowledgeApprovalEvents` 의 status="rejected"
- stub promote/dismiss 실패 시 client 로 throw — 재시도 가능
- publish 실패 시 `knowledgePublishes/{publishId}.status === "failed"` + `lastError`

## Mission v2 이전 흐름 (참고)

이전 버전에는 `enqueueExtractionJob` / `processExtractionJob` /
`reclaimStaleExtractionJobs` 가 cloud LLM (Gemini / Claude) 으로 markdown
을 분석해 `knowledgeExtractionOutputs` 를 만들었음. mission v2 가 비용
모델을 user-side AI agent 로 옮기면서 제거됨 (`docs/MISSION-CLEANUP-CANDIDATES.md` Stage 3 참고).

기존 `knowledgeExtractionOutputs` 데이터는 보존됨 (검수자가 `applyReviewAction`
으로 여전히 review 가능). 새로운 output 은 user-side agent 가 `mcp__oh-my-ontology__add_concept`
같은 도구로 vault frontmatter 에 직접 작성.
