type DocumentData = Record<string, unknown>;
import { coerceFirestoreDate } from '@/shared/lib/firestore-timestamp-coerce';
import type {
  OntologyClass,
  OntologyClassInput,
  OntologyElementType,
} from './types';

const ELEMENT_TYPES: OntologyElementType[] = [
  'service',
  'api',
  'agent',
  'workflow',
  'schema',
  'data-store',
  'ui',
  'prompt',
  'integration',
];

function toElementType(value: unknown): OntologyElementType | undefined {
  if (typeof value !== 'string') return undefined;
  return ELEMENT_TYPES.includes(value as OntologyElementType)
    ? (value as OntologyElementType)
    : undefined;
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

export function fromFirestore(id: string, data: DocumentData): OntologyClass {
  return {
    id,
    name: String(data.name ?? id),
    description: data.description ? String(data.description) : undefined,
    parentClassId: data.parentClassId ? String(data.parentClassId) : undefined,
    elementType: toElementType(data.elementType),
    version: typeof data.version === 'number' ? data.version : 1,
    createdAt: toDate(data.createdAt),
    createdBy: String(data.createdBy ?? 'system'),
    updatedAt: toOptionalDate(data.updatedAt),
  };
}

export function toFirestore(input: OntologyClassInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name,
    version: input.version,
    createdBy: input.createdBy,
  };
  if (input.description !== undefined) payload.description = input.description;
  if (input.parentClassId !== undefined) payload.parentClassId = input.parentClassId;
  if (input.elementType !== undefined) payload.elementType = input.elementType;
  return payload;
}
