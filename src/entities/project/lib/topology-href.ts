import { appendWorkspaceProjectQuery } from "@/shared/lib/account-scope";

export function getTopologyProjectHref(
  slug: string,
  _accountId?: string | null,
  projectId?: string | null,
): string {
  return appendWorkspaceProjectQuery(
    `/?p=${encodeURIComponent(slug)}`,
    projectId,
  );
}
