'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, FolderX, HardDrive, RefreshCw, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/shared/ui';

interface Props {
  status:
    | 'idle'
    | 'opening'
    | 'loading'
    | 'loaded'
    | 'permission-needed'
    | 'unsupported'
    | 'error';
  handleName: string | null;
  docCount: number;
  errorMessage: string | null;
  /** 마지막 스캔 epoch ms. null 이면 표시 안 함. */
  lastLoadedAt: number | null;
  onOpen: () => void;
  onClose: () => void;
  onRefresh: () => void;
  onRequestPermission: () => void;
}

function formatRelative(
  now: number,
  ts: number,
  t: ReturnType<typeof useTranslations>,
): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return t('relativeJustNow');
  if (s < 60) return t('relativeSeconds', { count: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('relativeMinutes', { count: m });
  const h = Math.floor(m / 60);
  return t('relativeHours', { count: h });
}

/**
 * 로컬 볼트 상단 바. 폴더 미선택 → 열기 버튼. 선택 후 → 폴더 이름 + 새로
 * 고침 + 닫기. 권한 만료 → 재요청. 브라우저 미지원 → 안내.
 */
export function LocalVaultPicker({
  status,
  handleName,
  docCount,
  errorMessage,
  lastLoadedAt,
  onOpen,
  onClose,
  onRefresh,
  onRequestPermission,
}: Props) {
  const t = useTranslations('featuresMisc.localVaultPicker');
  // 상대시각이 실시간으로 업데이트되도록 15초 tick. loaded 상태일 때만 작동.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'loaded' || lastLoadedAt === null) return;
    const t = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [status, lastLoadedAt]);
  if (status === 'unsupported') {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-md border border-[color:rgba(244,183,49,0.35)] bg-[color:rgba(244,183,49,0.12)] px-3 py-1.5 text-[11.5px] text-[color:var(--color-status-warning)]">
        <Shield size={12} aria-hidden />
        {t('unsupported')}
      </div>
    );
  }
  if (status === 'permission-needed') {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-md border border-[color:rgba(244,183,49,0.35)] bg-[color:rgba(244,183,49,0.12)] px-3 py-1.5 text-[11.5px] text-[color:var(--color-status-warning)]">
        <Shield size={12} aria-hidden />
        <span className="flex-1">{t('permissionNeeded')}</span>
        <button
          type="button"
          onClick={onRequestPermission}
          className="rounded-sm border border-[color:rgba(244,183,49,0.35)] px-2 py-0.5 text-[11px] transition-colors hover:bg-[color:rgba(244,183,49,0.18)]"
        >
          {t('permissionReauth')}
        </button>
        <Tooltip content={t('permissionClearTooltip')} withProvider={false}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-transparent px-1.5 py-0.5 text-[11px] text-[color:var(--color-text-tertiary)] transition-colors hover:text-[color:var(--color-text-primary)]"
          >
            {t('permissionClearLabel')}
          </button>
        </Tooltip>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-[color:rgba(229,72,77,0.32)] bg-[color:rgba(229,72,77,0.08)] px-3 py-1.5 text-[11.5px] text-[color:var(--color-status-danger)]">
        <span className="truncate">
          {errorMessage ?? t('errorFallback')}
        </span>
        <span className="text-[color:rgba(240,180,180,0.7)]">
          {t('errorHint')}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto rounded-sm border border-[color:rgba(229,72,77,0.32)] px-2 py-0.5 text-[11px] transition-colors hover:bg-[color:rgba(229,72,77,0.14)]"
        >
          {t('errorReselect')}
        </button>
      </div>
    );
  }
  if (status === 'loaded' && handleName) {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-md border border-[color:var(--color-divider)] bg-[color:var(--color-elevated)] px-3 py-1.5 text-[11.5px] text-[color:var(--color-text-tertiary)]">
        <HardDrive
          size={12}
          className="text-[color:var(--color-indigo-accent)]"
          aria-hidden
        />
        <span className="truncate text-[color:var(--color-text-primary)]">
          {handleName}
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]">
          {t('loadedDocCount', { count: docCount })}
        </span>
        {lastLoadedAt !== null ? (
          <span
            className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[color:var(--color-text-quaternary)]"
            title={new Date(lastLoadedAt).toLocaleString('ko-KR')}
          >
            {t('loadedScannedSuffix', {
              relative: formatRelative(nowTick, lastLoadedAt, t),
            })}
          </span>
        ) : null}
        <Tooltip content={t('rescanTooltip')} withProvider={false}>
          <button
            type="button"
            onClick={onRefresh}
            aria-label={t('rescanAriaLabel')}
            className="ml-auto inline-flex items-center gap-1 rounded-sm border border-transparent px-1.5 py-0.5 text-[11px] text-[color:var(--color-text-tertiary)] transition-colors hover:border-[color:rgba(94,106,210,0.3)] hover:text-[color:var(--color-text-primary)]"
          >
            <RefreshCw size={11} aria-hidden />
          </button>
        </Tooltip>
        <Tooltip content={t('closeTooltip')} withProvider={false}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeAriaLabel')}
            className="inline-flex items-center gap-1 rounded-sm border border-transparent px-1.5 py-0.5 text-[11px] text-[color:var(--color-text-tertiary)] transition-colors hover:border-[color:rgba(229,72,77,0.32)] hover:text-[color:var(--color-status-danger)]"
          >
            <FolderX size={11} aria-hidden />
          </button>
        </Tooltip>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={status === 'opening' || status === 'loading'}
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-[color:rgba(94,106,210,0.3)] bg-[color:rgba(94,106,210,0.06)] px-3 py-1.5 text-[11.5px] text-[color:var(--color-indigo-accent)] transition-colors hover:border-[color:rgba(94,106,210,0.46)] hover:bg-[color:rgba(94,106,210,0.1)] disabled:opacity-60"
    >
      <FolderOpen size={12} aria-hidden />
      {status === 'opening'
        ? t('openOpening')
        : status === 'loading'
          ? t('openLoading')
          : t('openLabel')}
    </button>
  );
}
