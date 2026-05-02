type DocumentData = Record<string, unknown>;
import { coerceFirestoreDate } from "@/shared/lib/firestore-timestamp-coerce";
import type { KnowledgeEvidence } from "./types";

export function fromFirestoreKnowledgeEvidence(
  id: string,
  data: DocumentData,
): KnowledgeEvidence {
  return {
    id,
    documentId: String(data.documentId ?? ""),
    documentVersionId: String(data.documentVersionId ?? ""),
    versionHash: String(data.versionHash ?? ""),
    chunkId: String(data.chunkId ?? ""),
    chunkHash: String(data.chunkHash ?? ""),
    charStart: typeof data.charStart === "number" ? data.charStart : 0,
    charEnd: typeof data.charEnd === "number" ? data.charEnd : 0,
    excerpt: String(data.excerpt ?? ""),
    locatorVersion: String(data.locatorVersion ?? ""),
    extractorVersion: String(data.extractorVersion ?? ""),
    sourceOutputId: String(data.sourceOutputId ?? ""),
    createdAt: toDate(data.createdAt),
  };
}

function toDate(value: unknown): Date {
  return coerceFirestoreDate(value);
}
