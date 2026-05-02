import type { Project, ProjectInput } from './types';

/**
 * `Project` → `ProjectInput` 매핑.
 *
 * 인라인 편집 등에서 기존 프로젝트 한 필드만 patch 하고 나머지를 그대로
 * 들고 갈 때 사용. 결정성 유지를 위해 array / nested object 는 모두 새로
 * 생성 (참조 공유 회피).
 */
export function projectToInput(project: Project): ProjectInput {
  return {
    slug: project.slug,
    name: project.name,
    description: project.description,
    category: project.category,
    status: project.status,
    owner: project.owner,
    isHub: project.isHub,
    progress: project.progress,
    tags: [...project.tags],
    stack: [...project.stack],
    dependencies: [...project.dependencies],
    timeline: { ...project.timeline },
    links: project.links.map((l) => ({ ...l })),
    screenshots: [...project.screenshots],
    position: { ...project.position },
  };
}
