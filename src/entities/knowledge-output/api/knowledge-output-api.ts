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
import {
  fromFirestoreKnowledgeOutput,
  type KnowledgeOutput,
} from "@/entities/knowledge-output/model";

const COLLECTION = "knowledgeExtractionOutputs";

function knowledgeOutputsCollection() {
  return collection(getDb(), COLLECTION);
}

export function subscribeKnowledgeOutputsByDocument(
  documentId: string,
  callback: (outputs: KnowledgeOutput[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeOutputsByDocument(
  accountId: string | null | undefined,
  documentId: string,
  callback: (outputs: KnowledgeOutput[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeOutputsByDocument(
  accountIdOrDocumentId: string | null | undefined,
  documentIdOrCallback:
    | string
    | ((outputs: KnowledgeOutput[]) => void),
  callbackOrOnError?:
    | ((outputs: KnowledgeOutput[]) => void)
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
      ? (callbackOrOnError as (outputs: KnowledgeOutput[]) => void)
      : (documentIdOrCallback as (outputs: KnowledgeOutput[]) => void);
  const errorFn =
    typeof documentIdOrCallback === "string"
      ? maybeOnError
      : (callbackOrOnError as ((error: Error) => void) | undefined);

  return onSnapshot(
    query(
      knowledgeOutputsCollection(),
      ...(scopedAccountId ? [where("accountId", "==", scopedAccountId)] : []),
      where("documentId", "==", targetDocumentId),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      callbackFn(
        snapshot.docs.map((entry) =>
          fromFirestoreKnowledgeOutput(entry.id, entry.data()),
        ),
      );
    },
    (error) => {
      if (errorFn) errorFn(error);
      else console.error("[subscribeKnowledgeOutputsByDocument]", error);
    },
  );
}

