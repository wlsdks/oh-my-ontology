/**
 * IndexedDB-backed store for `LocalFsHandleRecord`.
 *
 * 단일 record 모드 (id = 'current') 가 default. 과거 docs-vault-local 이
 * 직접 raw `FileSystemDirectoryHandle` 만 저장하던 키 (`docs-vault:current-handle`)
 * 는 첫 read 시 자동으로 새 record 형태로 마이그레이션 후 폐기.
 */

import { idbDel, idbGet, idbSet } from '@/shared/lib/idb-kv';
import type { LocalFsHandleRecord } from '../model/types';

export const CURRENT_LOCAL_FS_HANDLE_ID = 'current';

const KEY_PREFIX = 'docs-vault:fs-handle:';
const LEGACY_KEY = 'docs-vault:current-handle';

function recordKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

/**
 * id 에 해당하는 record 를 읽는다. 없으면 undefined.
 *
 * id 가 'current' 일 때만, legacy 키에 raw 핸들이 남아있으면 record 로
 * 감싸서 마이그레이션 (legacy 키는 삭제).
 */
export async function getLocalFsHandle(
  id: string = CURRENT_LOCAL_FS_HANDLE_ID,
): Promise<LocalFsHandleRecord | undefined> {
  const stored = await idbGet<LocalFsHandleRecord>(recordKey(id));
  if (stored) return stored;

  if (id === CURRENT_LOCAL_FS_HANDLE_ID) {
    const legacy = await idbGet<FileSystemDirectoryHandle>(LEGACY_KEY);
    if (legacy) {
      const now = Date.now();
      const migrated: LocalFsHandleRecord = {
        id: CURRENT_LOCAL_FS_HANDLE_ID,
        handle: legacy,
        name: legacy.name,
        createdAt: now,
        lastAccessedAt: now,
      };
      await idbSet(recordKey(CURRENT_LOCAL_FS_HANDLE_ID), migrated);
      await idbDel(LEGACY_KEY);
      return migrated;
    }
  }
  return undefined;
}

export async function putLocalFsHandle(record: LocalFsHandleRecord): Promise<void> {
  await idbSet(recordKey(record.id), record);
}

export async function deleteLocalFsHandle(
  id: string = CURRENT_LOCAL_FS_HANDLE_ID,
): Promise<void> {
  await idbDel(recordKey(id));
}

/** 마지막 접근 시각만 갱신. record 자체가 없으면 no-op. */
export async function touchLocalFsHandle(
  id: string = CURRENT_LOCAL_FS_HANDLE_ID,
): Promise<void> {
  const existing = await idbGet<LocalFsHandleRecord>(recordKey(id));
  if (!existing) return;
  await idbSet(recordKey(id), { ...existing, lastAccessedAt: Date.now() });
}
