// Firestore `DocumentData` 는 indexable any 라 mapper 안 cast 가 자유롭다.
// firebase 의존을 끊으려고 local alias 로 동등 타입 정의.
type DocumentData = { [k: string]: unknown };
import type { Project, ProjectInput } from './types';
import { coerceFirestoreDate } from '@/shared/lib/firestore-timestamp-coerce';

type FirestoreRecord = Record<string, unknown>;

function toDateOrUndefined(value: unknown): Date | undefined {
  if (value === undefined || value === null) return undefined;
  const d = coerceFirestoreDate(value);
  return d.getTime() === 0 ? undefined : d;
}

/**
 * Firestore 문서 데이터를 앱 도메인 모델(Project)로 변환.
 * Timestamp → Date, 누락 필드는 안전한 기본값으로 채운다.
 */
export function fromFirestore(slug: string, data: DocumentData): Project {
  const d = data as FirestoreRecord;
  const timeline = (d.timeline as FirestoreRecord | undefined) ?? {};
  const position = (d.position as FirestoreRecord | undefined) ?? {};
  return {
    accountId: (d.accountId as string | undefined) ?? undefined,
    slug,
    name: (d.name as string | undefined) ?? '',
    nameEn: (d.nameEn as string | undefined) ?? undefined,
    category: ((d.category as string | undefined) ?? 'in-progress') as Project['category'],
    status: ((d.status as string | undefined) ?? 'idea') as Project['status'],
    description: (d.description as string | undefined) ?? '',
    detail: (d.detail as string | undefined) ?? undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    stack: Array.isArray(d.stack) ? (d.stack as string[]) : [],
    links: Array.isArray(d.links) ? (d.links as Project['links']) : [],
    dependencies: Array.isArray(d.dependencies) ? (d.dependencies as Project['dependencies']) : [],
    owner: (d.owner as Project['owner']) ?? undefined,
    icon: (d.icon as string | undefined) ?? undefined,
    screenshots: Array.isArray(d.screenshots) ? (d.screenshots as string[]) : [],
    timeline: {
      startedAt: toDateOrUndefined(timeline.startedAt),
      launchedAt: toDateOrUndefined(timeline.launchedAt),
    },
    progress: typeof d.progress === 'number' ? d.progress : undefined,
    isHub: Boolean(d.isHub),
    hubSlugs: Array.isArray(d.hubSlugs)
      ? (d.hubSlugs as unknown[]).filter((s): s is string => typeof s === 'string' && s.length > 0)
      : undefined,
    position: {
      x: typeof position.x === 'number' ? position.x : 0,
      y: typeof position.y === 'number' ? position.y : 0,
    },
    createdAt: coerceFirestoreDate(d.createdAt),
    updatedAt: coerceFirestoreDate(d.updatedAt),
  };
}

/**
 * 앱 도메인 모델을 Firestore 쓰기용 객체로 변환.
 * slug는 문서 ID로 빠지고, Date는 그대로 (쓰기 시 serverTimestamp 또는 Timestamp 사용).
 * undefined 필드는 제거한다 (Firestore는 undefined 거부).
 */
export function toFirestore(project: Omit<Project, 'slug' | 'createdAt' | 'updatedAt'>): DocumentData {
  const payload: DocumentData = {
    accountId: project.accountId ?? null,
    name: project.name,
    category: project.category,
    status: project.status,
    description: project.description,
    tags: project.tags,
    stack: project.stack,
    links: project.links,
    dependencies: project.dependencies,
    screenshots: project.screenshots,
    isHub: project.isHub,
    position: project.position,
    timeline: {
      startedAt: project.timeline.startedAt ?? null,
      launchedAt: project.timeline.launchedAt ?? null,
    },
  };

  if (project.nameEn !== undefined) payload.nameEn = project.nameEn;
  if (project.detail !== undefined) payload.detail = project.detail;
  if (project.owner !== undefined) payload.owner = project.owner;
  if (project.icon !== undefined) payload.icon = project.icon;
  if (project.progress !== undefined) payload.progress = project.progress;
  if (project.hubSlugs !== undefined) payload.hubSlugs = project.hubSlugs;

  return payload;
}

export function projectToInput(project: Project): ProjectInput {
  return {
    accountId: project.accountId,
    slug: project.slug,
    name: project.name,
    nameEn: project.nameEn,
    category: project.category,
    status: project.status,
    description: project.description,
    detail: project.detail,
    tags: [...project.tags],
    stack: [...project.stack],
    links: [...project.links],
    dependencies: [...project.dependencies],
    owner: project.owner,
    icon: project.icon,
    screenshots: [...project.screenshots],
    timeline: { ...project.timeline },
    progress: project.progress,
    isHub: project.isHub,
    hubSlugs: project.hubSlugs ? [...project.hubSlugs] : undefined,
    position: { ...project.position },
  };
}
