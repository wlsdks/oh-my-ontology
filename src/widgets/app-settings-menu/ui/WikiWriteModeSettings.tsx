"use client";

import { useTranslations } from 'next-intl';

import { useWikiWriteMode, writeWikiWriteMode, type WikiWriteMode } from '@/shared/lib/appearance-preferences';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { SettingsRow } from './settings-primitives';

/**
 * How an agent's wiki page lands: written at once when it fits the contract, or stopped
 * at the permission card every time. A setting, not a door — it governs every Compile,
 * Fix and proposal — so it sits here beside the folder's shape rather than in the Library
 * column (owner, 2026-09-07).
 */
export function WikiWriteModeSettings() {
  const t = useTranslations('settings');
  const mode = useWikiWriteMode();
  return (
    <SettingsRow
      testId="app-settings-wiki-write-mode"
      label={t('wikiWriteModeLabel')}
      caption={mode === 'auto' ? t('wikiWriteModeAutoCaption') : t('wikiWriteModeAskCaption')}
      control={
        <SegmentedControl<WikiWriteMode>
          ariaLabel={t('wikiWriteModeLabel')}
          value={mode}
          onChange={(next) => writeWikiWriteMode(next)}
          options={[
            { value: 'auto', label: t('wikiWriteModeAuto'), testId: 'app-settings-wiki-write-mode-auto' },
            { value: 'ask', label: t('wikiWriteModeAsk'), testId: 'app-settings-wiki-write-mode-ask' },
          ]}
        />
      }
    />
  );
}
