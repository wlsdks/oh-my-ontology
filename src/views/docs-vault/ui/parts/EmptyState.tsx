import { useTranslations } from "next-intl";

/**
 * 문서 미선택 상태 — 트리에서 문서를 선택하라는 안내.
 *
 * 호출자: `DocsVaultContent` 의 viewer 영역 (selectedSlug 없을 때).
 */
export function EmptyState() {
  const t = useTranslations("vaultWidgets.parts.empty");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="text-[14px] text-[color:var(--color-text-tertiary)]">
        {t("selectPrompt")}
      </div>
    </div>
  );
}
