import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scope: 'local:first#1',
  resolveRun: null as ((value: { turn: unknown }) => void) | null,
}));

vi.mock('@/entities/vault-session', () => ({
  useLocalVault: () => ({
    sourceHandles: new Map(),
    fileHandles: new Map(),
    manifest: { docs: [] },
    createDoc: vi.fn(),
    saveDoc: vi.fn(),
    refresh: vi.fn(),
  }),
  useVaultSessionIdentityScope: () => mocks.scope,
}));

vi.mock('@/shared/lib/tauri-vault-fs', () => ({
  nativeVaultFileHashes: vi.fn(),
}));

vi.mock('@/shared/lib/tauri-llm', () => ({
  llmChat: vi.fn(),
  llmChatErrorMessage: () => 'failed',
}));

vi.mock('./agent-loop', () => ({
  startTurn: () => ({ id: 'turn-1' }),
  runTurn: () => new Promise((resolve) => {
    mocks.resolveRun = resolve as (value: { turn: unknown }) => void;
  }),
}));

vi.mock('./compile-adapter', () => ({ compileAdapter: {} }));
vi.mock('./compile-executor', () => ({
  createCompileExecutor: () => ({ execute: vi.fn(), proposals: () => [] }),
}));
vi.mock('./compile-system-prompt', () => ({ buildCompileSystemPrompt: () => 'system' }));
vi.mock('./compile-consent-card', () => ({
  buildCompileConsentCard: () => ({ proposal: null }),
}));

import { useLocalCompile } from './use-local-compile';

const args = {
  vaultRoot: '/vault',
  endpoint: { baseUrl: 'http://localhost:1234', model: 'local' },
  sources: [],
  labels: {
    createFile: (path: string) => `create ${path}`,
    modifyFile: (path: string) => `modify ${path}`,
    bridgeMissing: 'bridge missing',
  },
};

describe('useLocalCompile vault origin', () => {
  it('keeps the initiating vault scope on async work retained after the provider switches', async () => {
    mocks.scope = 'local:first#1';
    mocks.resolveRun = null;
    const { result, rerender } = renderHook(() => useLocalCompile(args));

    act(() => {
      void result.current.run('compile the current library');
    });
    await waitFor(() => expect(result.current.status).toBe('running'));
    expect(result.current.originVaultScope).toBe('local:first#1');

    mocks.scope = 'local:second#2';
    rerender();
    await act(async () => {
      mocks.resolveRun?.({ turn: { id: 'turn-1' } });
    });

    expect(result.current.status).toBe('waiting');
    expect(result.current.card).not.toBeNull();
    expect(result.current.originVaultScope).toBe('local:first#1');
  });
});
