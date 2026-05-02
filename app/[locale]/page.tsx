import { Suspense } from "react";
import type { Metadata } from "next";
import { RootEntryPage } from '@/views/root-entry';
import { absoluteUrl } from "@/shared/config";

// 공유 링크에 ?utm_* 같은 query 가 붙어도 SERP canonical 은 루트 하나로 고정.
// metadataBase 가 SITE_URL 을 이미 쥐고 있지만 정적 export 환경에서 절대 URL
// 로 명시적으로 박아 두는 게 안전.
export const metadata: Metadata = {
  alternates: {
    canonical: absoluteUrl('/'),
  },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RootEntryPage />
    </Suspense>
  );
}
