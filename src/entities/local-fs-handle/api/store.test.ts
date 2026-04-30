import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, unknown>();

vi.mock('@/shared/lib/idb-kv', () => ({
  idbGet: vi.fn(async (key: string) => memory.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    memory.set(key, value);
  }),
  idbDel: vi.fn(async (key: string) => {
    memory.delete(key);
  }),
}));

import {
  CURRENT_LOCAL_FS_HANDLE_ID,
  deleteLocalFsHandle,
  getLocalFsHandle,
  putLocalFsHandle,
  touchLocalFsHandle,
} from './store';
import type { LocalFsHandleRecord } from '../model/types';

function fakeHandle(name: string): FileSystemDirectoryHandle {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

beforeEach(() => {
  memory.clear();
});
afterEach(() => {
  memory.clear();
});

describe('local-fs-handle store', () => {
  it('put → get round-trip', async () => {
    const record: LocalFsHandleRecord = {
      id: CURRENT_LOCAL_FS_HANDLE_ID,
      handle: fakeHandle('Notes'),
      name: 'Notes',
      createdAt: 1000,
      lastAccessedAt: 1000,
    };
    await putLocalFsHandle(record);
    const restored = await getLocalFsHandle();
    expect(restored?.name).toBe('Notes');
    expect(restored?.handle.name).toBe('Notes');
  });

  it('delete 후 get 은 undefined', async () => {
    await putLocalFsHandle({
      id: CURRENT_LOCAL_FS_HANDLE_ID,
      handle: fakeHandle('Tmp'),
      name: 'Tmp',
      createdAt: 1,
      lastAccessedAt: 1,
    });
    await deleteLocalFsHandle();
    expect(await getLocalFsHandle()).toBeUndefined();
  });

  it('touch 는 lastAccessedAt 만 갱신', async () => {
    await putLocalFsHandle({
      id: CURRENT_LOCAL_FS_HANDLE_ID,
      handle: fakeHandle('A'),
      name: 'A',
      createdAt: 100,
      lastAccessedAt: 100,
    });
    const before = (await getLocalFsHandle())!;
    await new Promise((r) => setTimeout(r, 2));
    await touchLocalFsHandle();
    const after = (await getLocalFsHandle())!;
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.lastAccessedAt).toBeGreaterThan(before.lastAccessedAt);
  });

  it('touch 는 record 가 없으면 no-op', async () => {
    await touchLocalFsHandle();
    expect(await getLocalFsHandle()).toBeUndefined();
  });

  it('legacy 키 자동 마이그레이션', async () => {
    memory.set('docs-vault:current-handle', fakeHandle('OldVault'));
    const restored = await getLocalFsHandle();
    expect(restored?.name).toBe('OldVault');
    expect(restored?.id).toBe(CURRENT_LOCAL_FS_HANDLE_ID);
    // legacy 키는 삭제됨
    expect(memory.get('docs-vault:current-handle')).toBeUndefined();
    // 새 키는 살아있음
    expect(
      memory.get('docs-vault:fs-handle:current'),
    ).toBeDefined();
  });

  it('마이그레이션은 한 번만 — 이후 read 는 record 직접', async () => {
    memory.set('docs-vault:current-handle', fakeHandle('OldVault'));
    const first = await getLocalFsHandle();
    const second = await getLocalFsHandle();
    expect(first?.name).toBe(second?.name);
    expect(memory.get('docs-vault:current-handle')).toBeUndefined();
  });

  it('multi-id 분리 저장', async () => {
    await putLocalFsHandle({
      id: 'current',
      handle: fakeHandle('A'),
      name: 'A',
      createdAt: 1,
      lastAccessedAt: 1,
    });
    await putLocalFsHandle({
      id: 'archive',
      handle: fakeHandle('B'),
      name: 'B',
      createdAt: 2,
      lastAccessedAt: 2,
    });
    expect((await getLocalFsHandle('current'))?.name).toBe('A');
    expect((await getLocalFsHandle('archive'))?.name).toBe('B');
  });
});
