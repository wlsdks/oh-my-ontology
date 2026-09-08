import { describe, expect, it } from 'vitest';

import type { AcpEvent, PendingPermission } from './use-acp-session';
import { deriveAcpTurnActivity, deriveAcpTurnToolActivity } from './acp-turn-activity';

const known = new Set(['capabilities/reviewed-ontology-writing']);

describe('deriveAcpTurnActivity', () => {
  it('대기 중인 검증 도구에서 목표와 대상을 뽑는다', () => {
    const events: AcpEvent[] = [
      { kind: 'user', id: 'u1', text: '관계 편집 흐름을 확인해줘' },
      {
        kind: 'tool',
        id: 't1',
        title: 'validate_vault',
        toolKind: 'read',
        status: 'pending',
        rawInput: { slug: 'capabilities/reviewed-ontology-writing' },
      },
    ];
    expect(deriveAcpTurnActivity('thinking', events, null, known)).toEqual({
      state: 'verifying',
      summary: '관계 편집 흐름을 확인해줘',
      ontologySlug: 'capabilities/reviewed-ontology-writing',
      toolName: 'validate_vault',
    });
  });

  it('사람의 권한 확인을 기다리면 blocked 로 말한다', () => {
    const pending = {
      request: {
        title: null,
        toolCallId: 'tool-relation',
        toolName: 'mcp__atlas-vault__add_relation',
        toolKind: 'write',
        filePath: null,
        rawInput: { from: 'capabilities/reviewed-ontology-writing' },
        reviewKind: 'ontology-write',
        options: [],
      },
      resolve: () => undefined,
    } satisfies PendingPermission;
    expect(
      deriveAcpTurnActivity(
        'thinking',
        [{ kind: 'user', id: 'u1', text: '관계를 추가해줘' }],
        pending,
        known,
      ),
    ).toMatchObject({ state: 'blocked', summary: '관계를 추가해줘' });
  });

  it('차례가 아니면 활동을 만들지 않는다', () => {
    expect(deriveAcpTurnActivity('ready', [], null, known)).toBeNull();
  });

  it('실제 대기 도구와 권한 대기만 구조화된 스냅샷으로 넘긴다', () => {
    const pendingTool: AcpEvent[] = [{
      kind: 'tool',
      id: 'read-source',
      title: 'read_source',
      toolKind: 'read',
      status: 'pending',
      rawInput: { path: 'sources/plan.txt' },
    }];
    expect(deriveAcpTurnToolActivity('thinking', pendingTool, null)).toEqual({
      id: 'read-source',
      toolKind: 'read',
      status: 'pending',
      rawInput: { path: 'sources/plan.txt' },
      pendingPermission: false,
    });
    expect(deriveAcpTurnToolActivity('ready', pendingTool, null)).toBeNull();
  });

  it('새 사람 차례 뒤에는 이전 차례의 취소된 도구를 되살리지 않는다', () => {
    const events: AcpEvent[] = [
      { kind: 'user', id: 'u1', text: '첫 번째 요청' },
      {
        kind: 'tool',
        id: 'old-read',
        title: 'Read old',
        toolKind: 'read',
        status: 'pending',
        rawInput: { path: 'sources/old.md' },
      },
      { kind: 'tool', id: 'old-read-finished', title: 'Read old', toolKind: 'read', status: 'cancelled' },
      { kind: 'user', id: 'u2', text: '두 번째 요청' },
    ];
    expect(deriveAcpTurnToolActivity('thinking', events, null)).toBeNull();
  });
});
