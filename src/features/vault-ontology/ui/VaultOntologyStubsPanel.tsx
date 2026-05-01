'use client';

import { Sparkles } from 'lucide-react';
import { useVaultOntology } from '../model/use-vault-ontology';

/**
 * 로컬 vault 에서 추출한 ontology stub 들을 *간결한 리스트*로 보여주는 패널.
 *
 * 통합 트리 / ego 그래프 와는 별개 — 이건 *fast path* 의 입증용 surface.
 * stub 은 evidence 미부여 (검수 안 됨) 상태로, 사용자가 frontmatter 만으로
 * 즉시 ontology 가 자라는 모습을 보여 mission 약속의 절반을 가시화.
 *
 * 디자인 헌장 안: 단일 인디고 + 무채색, 애니메이션 0.
 */
export function VaultOntologyStubsPanel() {
  const { nodes, edges, warnings } = useVaultOntology();

  if (nodes.length === 0) {
    return (
      <section
        aria-labelledby="vault-stubs-heading"
        className="rounded-2xl border border-dashed border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-5 py-6"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[color:var(--color-text-quaternary)]" aria-hidden />
          <h2
            id="vault-stubs-heading"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-quaternary)]"
          >
            vault frontmatter ontology
          </h2>
        </div>
        <p className="mt-3 text-[12.5px] leading-6 text-[color:var(--color-text-tertiary)]">
          {warnings[0] ??
            'vault 의 .md 어디에도 frontmatter `kind:` 가 없어 stub 후보가 비어있습니다. 문서 상단에 `kind: project` (또는 capability / element / workflow / decision) 추가 시 즉시 노드로 자랍니다.'}
        </p>
      </section>
    );
  }

  // kind 별 그룹화 — UI 위계 — sorted by kind 알파벳 순.
  const byKind = new Map<string, typeof nodes>();
  for (const n of nodes) {
    if (!byKind.has(n.kind)) byKind.set(n.kind, []);
    byKind.get(n.kind)!.push(n);
  }
  const kinds = [...byKind.keys()].sort();

  return (
    <section
      aria-labelledby="vault-stubs-heading"
      className="rounded-2xl border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-1)] px-5 py-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[color:var(--color-indigo-accent)]" aria-hidden />
          <h2
            id="vault-stubs-heading"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-indigo-accent)]"
          >
            vault frontmatter ontology
          </h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
          {nodes.length} nodes · {edges.length} relations · stub
        </p>
      </header>
      <p className="mt-2 text-[12px] text-[color:var(--color-text-tertiary)]">
        AI 추출 거치지 않은 fast-path stub. evidence 가 붙으면 정식 ontology fact 로 승격됩니다.
      </p>
      <div className="mt-4 space-y-4">
        {kinds.map((kind) => {
          const group = byKind.get(kind)!;
          return (
            <div key={kind}>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[color:var(--color-text-quaternary)]">
                {kind} · {group.length}
              </p>
              <ul className="mt-2 grid gap-1.5 md:grid-cols-2">
                {group.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-2 rounded-md border border-[color:var(--color-divider)] bg-[color:var(--color-overlay-2)] px-3 py-1.5"
                  >
                    <span className="truncate text-[13px] text-[color:var(--color-text-primary)]">
                      {n.title}
                    </span>
                    <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-[color:var(--color-text-quaternary)]">
                      {n.sourceSlug}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
