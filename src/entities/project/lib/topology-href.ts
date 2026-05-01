export function getTopologyProjectHref(
  slug: string,
  _accountId?: string | null,
  _projectId?: string | null,
): string {
  return `/?p=${encodeURIComponent(slug)}`;
}
