// Fictional sources. Expected obligations stay outside the model's input.
const page = (title, fact, source, note) => `---
title: ${title}
created_by: human
compiled_at: 2026-09-01T00:00:00Z
sources: [${source}]
status: draft
summary: ${title}
---

## Summary

${fact}

## Facts

- ${fact} [[src:${source}#p2]]

## Decisions

## Open questions

- ${note}

## Not in sources
`;

export const distractors = Array.from({ length: 36 }, (_, i) => ({
  slug: `wiki/orchard-${String(i).padStart(2, '0')}`,
  title: `Orchard cultivar ${i}`,
  raw: page(`Orchard cultivar ${i}`, `Apple cultivar ${i} grows beside pear trees.`, `sources/orchard-${i}.md`, 'Check fruit ripeness before picking.'),
}));

export const accumulationCases = [
  {
    id: 'dated-release', locale: 'en', target: 'sources/approval.md',
    sources: {
      'sources/release.md': '# Zephyr launch plan\n\nOn September 1, the Zephyr release was planned for September 15.\n',
      'sources/approval.md': '# Zephyr release approval\n\nOn September 10, Mira approved moving the Zephyr release to September 22 because review needed another week.\n',
    },
    existing: { slug: 'wiki/answers/release-date', title: 'Saved launch answer',
      raw: page('Saved launch answer', 'The Zephyr release is planned for September 15.', 'sources/release.md', 'Human note: Check the support roster before launch.') },
    gold: {
      prior: { pattern: 'September\\s+15|2026-09-15', citation: '[[src:sources/release.md#p2]]' },
      incoming: { pattern: 'September\\s+22|2026-09-22', citation: '[[src:sources/approval.md#p2]]' },
      note: 'Human note: Check the support roster before launch.',
      summaryPattern: 'September\\s+22|2026-09-22',
      openQuestionPattern: 'September\\s+15|2026-09-15',
    },
    oracle: {
      overview: ['Mira approved moving the Zephyr release to September 22 on September 10.'],
      facts: ['Originally planned for September 15. [[src:sources/release.md#p2]]', 'Approved date is September 22. [[src:sources/approval.md#p2]]'],
      decisions: ['Mira approved the revised date on September 10. [[src:sources/approval.md#p2]]'],
      open_questions: ['Earlier September 15 plan differs from the September 22 approval. [[src:sources/release.md#p2]] [[src:sources/approval.md#p2]]', 'Human note: Check the support roster before launch.'],
    },
  },
  {
    id: 'unresolved-retention-ko', locale: 'ko', target: 'sources/operations.md',
    sources: {
      'sources/design.md': '# 감사로그 설계\n\n감사로그는 30일 보관한다. 이 문서에는 승인자와 결정일이 없다.\n',
      'sources/operations.md': '# 감사로그 운영 메모\n\n감사로그의 보관기간은 90일이다. 이 메모에는 승인자와 결정일이 없다.\n',
    },
    existing: { slug: 'wiki/answers/audit-retention', title: '저장된 답변',
      raw: page('저장된 답변', '감사로그는 30일 보관한다.', 'sources/design.md', '사람 메모: 외부 감사 일정은 지수에게 확인할 것.') },
    gold: {
      prior: { pattern: '30\\s*(?:일|days?)', citation: '[[src:sources/design.md#p2]]' },
      incoming: { pattern: '90\\s*(?:일|days?)', citation: '[[src:sources/operations.md#p2]]' },
      note: '사람 메모: 외부 감사 일정은 지수에게 확인할 것.',
      summaryPattern: '미해결|불일치|상충|충돌|확정할 수 없|확인.*필요|unresolved|conflict|disagree|cannot determine',
      openQuestionPattern: '30\\s*(?:일|days?)[\\s\\S]*90\\s*(?:일|days?)|90\\s*(?:일|days?)[\\s\\S]*30\\s*(?:일|days?)',
    },
    oracle: {
      overview: ['감사로그 보관기간은 30일과 90일로 상충하며, 승인자와 결정일이 없어 미해결이다.'],
      facts: ['설계 문서는 30일 보관을 명시한다. [[src:sources/design.md#p2]]', '운영 메모는 90일 보관을 명시한다. [[src:sources/operations.md#p2]]'],
      decisions: [],
      open_questions: ['30일과 90일의 불일치는 승인 근거가 없어 미해결이다. [[src:sources/design.md#p2]] [[src:sources/operations.md#p2]]', '사람 메모: 외부 감사 일정은 지수에게 확인할 것.'],
    },
  },
  {
    id: 'older-arrives-last', locale: 'en', target: 'sources/early-budget.md',
    sources: {
      'sources/approved-budget.md': '# Lumen budget decision\n\nOn September 9, Ada approved a Lumen budget of USD 15000, replacing the September 1 draft.\n',
      'sources/early-budget.md': '# Lumen budget draft\n\nThe September 1 draft proposes a Lumen budget of USD 10000. It is not approved.\n',
    },
    existing: { slug: 'wiki/answers/lumen-budget', title: 'Saved finance answer',
      raw: page('Saved finance answer', 'Lumen has an approved budget of USD 15000.', 'sources/approved-budget.md', 'Human note: Keep the accessibility review in scope.') },
    gold: {
      prior: { pattern: '15,?000', citation: '[[src:sources/approved-budget.md#p2]]' },
      incoming: { pattern: '10,?000', citation: '[[src:sources/early-budget.md#p2]]' },
      note: 'Human note: Keep the accessibility review in scope.',
      summaryPattern: '15,?000',
      openQuestionPattern: '10,?000',
    },
    oracle: {
      overview: ['The approved Lumen budget remains USD 15000; the newly arrived draft is older.'],
      facts: ['Ada approved USD 15000 on September 9. [[src:sources/approved-budget.md#p2]]', 'The September 1 draft proposed USD 10000 without approval. [[src:sources/early-budget.md#p2]]'],
      decisions: ['The September 9 approval replaces the earlier draft. [[src:sources/approved-budget.md#p2]]'],
      open_questions: ['The older USD 10000 draft differs from the approved USD 15000 budget. [[src:sources/early-budget.md#p2]] [[src:sources/approved-budget.md#p2]]', 'Human note: Keep the accessibility review in scope.'],
    },
  },
];

export const negativeRetrieval = { path: 'sources/quasar.md', text: '# Quasar\n\nRadio astronomy measures pulsars and quasars.' };
