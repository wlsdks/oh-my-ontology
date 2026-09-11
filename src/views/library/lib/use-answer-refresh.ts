"use client";

import { useCallback, useRef, useState } from 'react';
import {
  answerRefreshBrief, answerRevisionStore, buildAnswerRevision,
  prepareAnswerRefresh, saveAnswerRevision, type AnswerRefreshSnapshot,
} from '@/features/library';

interface RefreshTurn {
  id: number;
  snapshot: AnswerRefreshSnapshot;
  writer: string;
}

interface RefreshState {
  phase: 'idle' | 'preparing' | 'running' | 'review' | 'saving';
  snapshot: AnswerRefreshSnapshot | null;
  proposal: ReturnType<typeof buildAnswerRevision> | null;
  error: string | null;
}

const INITIAL: RefreshState = { phase: 'idle', snapshot: null, proposal: null, error: null };

export function useAnswerRefresh({ handle, sources, writer, vaultRoot, start }: {
  handle: FileSystemDirectoryHandle | null;
  sources: readonly { path: string }[];
  writer: string;
  vaultRoot: string | null;
  start: (text: string, kind: 'refresh') => void;
}) {
  const [state, setState] = useState<RefreshState>(INITIAL);
  const generation = useRef(0);
  const pending = useRef<RefreshTurn | null>(null);
  const locked = useRef(false);

  const begin = useCallback(async (slug: string) => {
    if (!handle || !vaultRoot || locked.current) return;
    locked.current = true;
    const id = ++generation.current;
    pending.current = null;
    setState({ ...INITIAL, phase: 'preparing' });
    try {
      const snapshot = await prepareAnswerRefresh(answerRevisionStore(handle), slug, sources.map((source) => source.path));
      if (generation.current !== id) return;
      pending.current = { id, snapshot, writer };
      setState({ phase: 'running', snapshot, proposal: null, error: null });
      start(answerRefreshBrief({
        question: snapshot.question, previousSlug: slug, previousText: snapshot.previousText,
        vaultRoot, sources: snapshot.sourcePaths,
      }), 'refresh');
    } catch (error) {
      if (generation.current === id) setState({ ...INITIAL, error: error instanceof Error ? error.message : String(error) });
    } finally { locked.current = false; }
  }, [handle, sources, start, vaultRoot, writer]);

  const capture = useCallback(() => pending.current, []);
  const receive = useCallback((turn: RefreshTurn, response: string | null, outcome: string) => {
    if (generation.current !== turn.id || pending.current !== turn) return;
    pending.current = null;
    if (outcome !== 'completed' || !response?.trim()) {
      setState({ phase: 'idle', snapshot: turn.snapshot, proposal: null, error: 'The refresh did not complete. The previous answer is unchanged.' });
      return;
    }
    try {
      const proposal = buildAnswerRevision({ ...turn.snapshot, response, writer: turn.writer, now: new Date(), knownSources: turn.snapshot.sourcePaths });
      setState({ phase: 'review', snapshot: turn.snapshot, proposal, error: null });
    } catch (error) {
      setState({ phase: 'idle', snapshot: turn.snapshot, proposal: null, error: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  const save = useCallback(async () => {
    if (!handle || !state.snapshot || !state.proposal || state.proposal.problems.length || locked.current) return null;
    const id = generation.current;
    locked.current = true;
    setState((current) => ({ ...current, phase: 'saving', error: null }));
    try {
      const result = await saveAnswerRevision(answerRevisionStore(handle), state.snapshot, state.proposal);
      if (generation.current === id) setState(INITIAL);
      return result;
    } catch (error) {
      if (generation.current === id) setState((current) => ({ ...current, phase: 'review', error: error instanceof Error ? error.message : String(error) }));
      return null;
    } finally { locked.current = false; }
  }, [handle, state.proposal, state.snapshot]);

  const dismiss = useCallback(() => {
    if (locked.current) return;
    generation.current += 1;
    pending.current = null;
    setState(INITIAL);
  }, []);

  return { ...state, begin, capture, receive, save, dismiss };
}
