import { deleteObject, getDownloadURL, ref, uploadString } from "firebase/storage";
import { getBucket } from "@/shared/api";
import { normalizeAccountId } from "@/shared/lib/account-scope";

export function buildKnowledgeDocumentStoragePath(
  documentId: string,
  versionId: string,
  accountId?: string | null,
): string {
  const normalizedAccountId = normalizeAccountId(accountId);
  return normalizedAccountId
    ? `accounts/${normalizedAccountId}/knowledge-documents/${documentId}/${versionId}.md`
    : `knowledge-documents/${documentId}/${versionId}.md`;
}

export async function uploadKnowledgeMarkdown(
  storagePath: string,
  markdown: string,
) {
  const bucket = getBucket();
  const storageRef = ref(bucket, storagePath);
  await uploadString(storageRef, markdown, "raw", {
    contentType: "text/markdown; charset=utf-8",
  });
  return getDownloadURL(storageRef);
}

export async function deleteKnowledgeMarkdown(storagePath: string) {
  const bucket = getBucket();
  const storageRef = ref(bucket, storagePath);
  try {
    await deleteObject(storageRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("object-not-found")) {
      throw error;
    }
  }
}

export async function downloadKnowledgeMarkdown(storagePath: string) {
  const bucket = getBucket();
  const storageRef = ref(bucket, storagePath);
  const url = await getDownloadURL(storageRef);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`마크다운 다운로드 실패: ${response.status}`);
  }

  return response.text();
}
