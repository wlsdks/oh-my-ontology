import { useLocale, useTranslations } from "next-intl";
import type { VaultDoc } from "@/entities/docs-vault";

/**
 * 읽는 시간 추정 — ≈200 단어/분 기준. 한글은 글자당 평균이 다르지만
 * 영·한 혼합 대략 감만 표시. 1분 미만은 "1분" 으로 floor.
 *
 * 추출 사유: 본 함수는 순수 — DocsVaultPage 본체에서 분리해 단위 test
 * 용이하게.
 */
export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

/**
 * 문서 본문 위 메타 바 — 단어 수 / 읽기 시간 / 태그 / 갱신일.
 *
 * 호출자: `DocsVaultContent` 안 viewer 영역 헤더.
 */
export function DocMetaBar({ doc }: { doc: VaultDoc }) {
  const t = useTranslations("vaultWidgets.parts.meta");
  const locale = useLocale();
  const numberLocale = locale === "ko" ? "ko-KR" : "en-US";
  const readingMinutes = estimateReadingMinutes(doc.wordCount);
  const updated = new Date(doc.updatedAt);
  return (
    <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-3 border-b border-[color:var(--color-overlay-2)] px-6 py-3 text-[11px] text-[color:var(--color-text-quaternary)] md:px-10">
      <span className="font-mono tabular-nums">
        {t("wordsUnit", { count: doc.wordCount.toLocaleString(numberLocale) })}
      </span>
      <span className="font-mono tabular-nums">
        {t("readingMinutes", { minutes: readingMinutes })}
      </span>
      {doc.tags.length > 0 ? (
        <span className="font-mono">
          {doc.tags.map((tag) => `#${tag}`).join(" ")}
        </span>
      ) : null}
      <span
        className="ml-auto font-mono tabular-nums"
        title={updated.toLocaleString(numberLocale)}
      >
        {updated.toLocaleDateString(numberLocale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })}
      </span>
    </div>
  );
}
