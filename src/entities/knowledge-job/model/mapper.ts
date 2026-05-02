type DocumentData = Record<string, unknown>;
import { coerceFirestoreDate } from "@/shared/lib/firestore-timestamp-coerce";
import type { KnowledgeJob } from "./types";

export function fromFirestoreKnowledgeJob(
  id: string,
  data: DocumentData,
): KnowledgeJob {
  return {
    id,
    documentId: String(data.documentId ?? ""),
    documentVersionId: String(data.documentVersionId ?? ""),
    extractorVersion: String(data.extractorVersion ?? ""),
    idempotencyKey: String(data.idempotencyKey ?? ""),
    status: (data.status as KnowledgeJob["status"]) ?? "queued",
    attemptCount: typeof data.attemptCount === "number" ? data.attemptCount : 0,
    maxAttempts: typeof data.maxAttempts === "number" ? data.maxAttempts : 1,
    retryable: Boolean(data.retryable),
    nextAttemptAt: toOptionalDate(data.nextAttemptAt),
    leaseOwner: typeof data.leaseOwner === "string" ? data.leaseOwner : undefined,
    leaseExpiresAt: toOptionalDate(data.leaseExpiresAt),
    generation: typeof data.generation === "number" ? data.generation : 0,
    errorCode: typeof data.errorCode === "string" ? data.errorCode : undefined,
    errorMessage:
      typeof data.errorMessage === "string" ? data.errorMessage : undefined,
    supersededByJobId:
      typeof data.supersededByJobId === "string"
        ? data.supersededByJobId
        : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    requestedBy: String(data.requestedBy ?? ""),
  };
}

function toDate(value: unknown): Date {
  return coerceFirestoreDate(value);
}

function toOptionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  // 매칭 안 되는 값은 coerceFirestoreDate 가 epoch 0 fallback. 호출자
  // 계약은 "정말 모르면 undefined" 라 epoch 0 은 undefined 로 정상화.
  const d = coerceFirestoreDate(value);
  return d.getTime() === 0 ? undefined : d;
}

