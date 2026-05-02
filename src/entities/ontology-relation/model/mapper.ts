type DocumentData = Record<string, unknown>;
import { coerceFirestoreDate } from '@/shared/lib/firestore-timestamp-coerce';
import type {
  OntologyRelation,
  OntologyRelationCategory,
  OntologyRelationInput,
  RelationCardinality,
} from './types';

const CATEGORIES: OntologyRelationCategory[] = ['structure', 'behavior', 'evidence', 'weak'];

function toCategory(value: unknown): OntologyRelationCategory {
  if (typeof value === 'string' && CATEGORIES.includes(value as OntologyRelationCategory)) {
    return value as OntologyRelationCategory;
  }
  return 'weak';
}

function toCardinality(value: unknown): RelationCardinality | undefined {
  return value === 'one' || value === 'many' ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toDate(value: unknown): Date {
  return coerceFirestoreDate(value);
}

function toOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null) return undefined;
  // 매칭 안 되는 값은 coerceFirestoreDate 가 epoch 0 fallback. 호출자
  // 계약은 "정말 모르면 undefined" 라 epoch 0 은 undefined 로 정상화.
  const d = coerceFirestoreDate(value);
  return d.getTime() === 0 ? undefined : d;
}

export function fromFirestore(id: string, data: DocumentData): OntologyRelation {
  return {
    id,
    name: String(data.name ?? id),
    inverseName: data.inverseName ? String(data.inverseName) : undefined,
    description: data.description ? String(data.description) : undefined,
    sourceClassIds: toStringArray(data.sourceClassIds),
    targetClassIds: toStringArray(data.targetClassIds),
    category: toCategory(data.category),
    symmetric: Boolean(data.symmetric),
    transitive: Boolean(data.transitive),
    sourceCardinality: toCardinality(data.sourceCardinality),
    targetCardinality: toCardinality(data.targetCardinality),
    version: typeof data.version === 'number' ? data.version : 1,
    createdAt: toDate(data.createdAt),
    createdBy: String(data.createdBy ?? 'system'),
    updatedAt: toOptionalDate(data.updatedAt),
  };
}

export function toFirestore(input: OntologyRelationInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name,
    sourceClassIds: input.sourceClassIds,
    targetClassIds: input.targetClassIds,
    category: input.category,
    symmetric: input.symmetric,
    transitive: input.transitive,
    version: input.version,
    createdBy: input.createdBy,
  };
  if (input.inverseName !== undefined) payload.inverseName = input.inverseName;
  if (input.description !== undefined) payload.description = input.description;
  if (input.sourceCardinality !== undefined) payload.sourceCardinality = input.sourceCardinality;
  if (input.targetCardinality !== undefined) payload.targetCardinality = input.targetCardinality;
  return payload;
}
