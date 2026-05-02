'use client';

import { useTranslations } from 'next-intl';
import type { VaultMode } from '@/entities/docs-vault';

type DocsVaultAudience = VaultMode | 'all';

interface Props {
  docMode: VaultMode;
  currentAudience: DocsVaultAudience;
  onSwitchAudience: (audience: DocsVaultAudience) => void;
}

const AUDIENCE_LABEL_KEY: Record<VaultMode, 'audiencePlanner' | 'audienceEngineer' | 'audienceBoth'> = {
  planner: 'audiencePlanner',
  engineer: 'audienceEngineer',
  both: 'audienceBoth',
};

export function DocsVaultAudienceMismatchNotice({
  docMode,
  currentAudience,
  onSwitchAudience,
}: Props) {
  const t = useTranslations('vaultWidgets.audienceMismatch');
  const targetAudience = docMode === 'both' ? 'all' : docMode;
  if (
    currentAudience === 'all' ||
    docMode === 'both' ||
    currentAudience === docMode
  ) {
    return null;
  }
  const audienceLabel = t(AUDIENCE_LABEL_KEY[docMode]);

  return (
    <section
      className="mx-auto max-w-[760px] px-6 pt-3 md:px-10"
      aria-label={t('sectionAria')}
    >
      <div className="flex flex-col gap-2 rounded-md border border-[color:rgba(224,196,140,0.2)] bg-[color:rgba(224,196,140,0.055)] px-3 py-2.5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-[color:rgba(232,210,170,0.94)]">
            {t('title')}
          </p>
          <p className="mt-0.5 text-[11px] leading-[1.5] text-[color:var(--color-text-tertiary)]">
            {t('body', { label: audienceLabel })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSwitchAudience(targetAudience)}
          className="flex-none rounded-sm border border-[color:rgba(224,196,140,0.32)] px-2.5 py-1.5 text-[11px] text-[color:rgba(232,210,170,0.94)] transition-colors hover:border-[color:rgba(224,196,140,0.55)] hover:text-[color:var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(224,196,140,0.45)]"
        >
          {t('switchButton', { label: audienceLabel })}
        </button>
      </div>
    </section>
  );
}
