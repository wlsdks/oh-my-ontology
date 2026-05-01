import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDb, getFirebaseFunctions } from "@/shared/api";
import { normalizeAccountId } from "@/shared/lib/account-scope";
import { hasDemoSession } from "@/shared/lib/demo-session";
import {
  type EnqueueKnowledgeExtractionJobInput,
  type EnqueueKnowledgeExtractionJobResult,
  fromFirestoreKnowledgeJob,
  type KnowledgeJob,
} from "@/entities/knowledge-job/model";

const COLLECTION = "knowledgeExtractionJobs";

function knowledgeJobsCollection() {
  return collection(getDb(), COLLECTION);
}

export async function enqueueKnowledgeExtractionJob(
  input: EnqueueKnowledgeExtractionJobInput,
): Promise<EnqueueKnowledgeExtractionJobResult> {
  const callable = httpsCallable<
    EnqueueKnowledgeExtractionJobInput,
    EnqueueKnowledgeExtractionJobResult
  >(getFirebaseFunctions(), "enqueueExtractionJob");

  const response = await callable(input);
  return response.data;
}

export function subscribeKnowledgeJobsByDocument(
  documentId: string,
  callback: (jobs: KnowledgeJob[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeJobsByDocument(
  accountId: string | null | undefined,
  documentId: string,
  callback: (jobs: KnowledgeJob[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe;
export function subscribeKnowledgeJobsByDocument(
  accountIdOrDocumentId: string | null | undefined,
  documentIdOrCallback:
    | string
    | ((jobs: KnowledgeJob[]) => void),
  callbackOrOnError?:
    | ((jobs: KnowledgeJob[]) => void)
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
      ? (callbackOrOnError as (jobs: KnowledgeJob[]) => void)
      : (documentIdOrCallback as (jobs: KnowledgeJob[]) => void);
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
      knowledgeJobsCollection(),
      ...(scopedAccountId ? [where("accountId", "==", scopedAccountId)] : []),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      callbackFn(
        snapshot.docs
          .map((entry) => fromFirestoreKnowledgeJob(entry.id, entry.data()))
          .filter((entry) => entry.documentId === targetDocumentId),
      );
    },
    (error) => {
      if (errorFn) errorFn(error);
      else console.error("[subscribeKnowledgeJobsByDocument]", error);
    },
  );
}

