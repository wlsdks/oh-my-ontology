import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProjectNewClientPage } from './ProjectNewClientPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return { title: t('pages.projectNew') };
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProjectNewClientPage />
    </Suspense>
  );
}
