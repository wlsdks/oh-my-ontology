"use client";

import { useEffect, useState } from 'react';
import type { VaultDoc } from '@/entities/docs-vault';
import { answerTextHash, isRetainedAnswerPath } from '@/features/library';

export function useAnswerHistory(doc: VaultDoc | null, docs: readonly VaultDoc[], pageTexts: ReadonlyMap<string, string>) {
  const value = doc?.frontmatter.answer_previous;
  const previous = typeof value === 'string' && isRetainedAnswerPath(value) ? value : null;
  const exists = previous !== null && docs.some((page) => page.slug === previous);
  const text = previous ? pageTexts.get(previous) : undefined;
  const expected = doc?.frontmatter.answer_previous_hash;
  const [measured, setMeasured] = useState<{ text: string; hash: string } | null>(null);
  useEffect(() => {
    if (text === undefined || !previous) return;
    let cancelled = false;
    void answerTextHash(text).then((hash) => { if (!cancelled) setMeasured({ text, hash }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [previous, text]);
  const state = value === undefined ? 'none' : !previous ? 'invalid' : !exists ? 'missing'
    : typeof expected !== 'string' || !/^[a-f0-9]{64}$/i.test(expected) ? 'unmeasured'
    : text === undefined || measured?.text !== text ? 'checking'
    : measured.hash === expected.toLowerCase() ? 'matches' : 'changed';
  return { previous, exists, state };
}
