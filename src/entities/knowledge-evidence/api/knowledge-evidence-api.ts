import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/shared/api";
import { normalizeAccountId } from "@/shared/lib/account-scope";
import { hasDemoSession } from "@/shared/lib/demo-session";
import {
  fromFirestoreKnowledgeEvidence,
  type KnowledgeEvidence,
} from "@/entities/knowledge-evidence/model";

const COLLECTION = "knowledgeEvidence";

function knowledgeEvidenceCollection() {
  return collection(getDb(), COLLECTION);
}

export function subscribeKnowledgeEvidenceByDocument(
  documentId: string,
  callback: (evidence: KnowledgeEvidence[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeEvidenceByDocument(
  accountId: string | null | undefined,
  documentId: string,
  callback: (evidence: KnowledgeEvidence[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeEvidenceByDocument(
  accountIdOrDocumentId: string | null | undefined,
  documentIdOrCallback:
    | string
    | ((evidence: KnowledgeEvidence[]) => void),
  callbackOrOnError?:
    | ((evidence: KnowledgeEvidence[]) => void)
    | ((error: Error) => void),
  maybeOnError?: (error: Error) => void,
): Unsubscribe {
  const scopedAccountId =
    typeof documentIdOrCallback === "string"
      ? normalizeAccountId(accountIdOrDocumentId)
      : null;
  const targetDocumentId =
    typeof documentIdOrCallback === "string"
      ? documentIdOrCallback
      : String(accountIdOrDocumentId ?? "");
  const callbackFn =
    typeof documentIdOrCallback === "string"
      ? (callbackOrOnError as (evidence: KnowledgeEvidence[]) => void)
      : (documentIdOrCallback as (evidence: KnowledgeEvidence[]) => void);
  const errorFn =
    typeof documentIdOrCallback === "string"
      ? maybeOnError
      : (callbackOrOnError as ((error: Error) => void) | undefined);

  if (hasDemoSession()) {
    Promise.resolve().then(() => callbackFn([]));
    return () => {};
  }

  return onSnapshot(
    query(
      knowledgeEvidenceCollection(),
      ...(scopedAccountId ? [where("accountId", "==", scopedAccountId)] : []),
      where("documentId", "==", targetDocumentId),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      callbackFn(
        snapshot.docs.map((entry) =>
          fromFirestoreKnowledgeEvidence(entry.id, entry.data()),
        ),
      );
    },
    (error) => {
      if (errorFn) errorFn(error);
      else console.error("[subscribeKnowledgeEvidenceByDocument]", error);
    },
  );
}

