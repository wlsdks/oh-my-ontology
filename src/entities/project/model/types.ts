/**
 * 프로젝트 카테고리 ID — `entities/category` 의 default 또는 미래 vault
 * frontmatter taxonomy 와 매칭되는 free string.
 */
export type ProjectCategory = string;

/**
 * 프로젝트 상태 ID — `entities/status` 의 default 또는 미래 vault
 * frontmatter taxonomy 와 매칭되는 free string.
 */
export type ProjectStatus = string;

export interface ProjectLink {
  label: string;
  url: string;
}

export interface ProjectTimeline {
  startedAt?: Date;
  launchedAt?: Date;
}

export interface ProjectPosition {
  x: number;
  y: number;
}

/**
 * 프로젝트 도메인 모델 (앱 내부에서 사용).
 *
 * 진실원: vault 의 `projects/<slug>.md` frontmatter (local 모드) 또는
 * 빌드타임 dogfood 매니페스트 (static 모드). createdAt / updatedAt 는
 * 파일 mtime 또는 frontmatter `createdAt:` / `updatedAt:` 에서 derive.
 */
export interface Project {
  slug: string;
  name: string;
  nameEn?: string;
  category: ProjectCategory;
  status: ProjectStatus;
  description: string;
  detail?: string;
  tags: string[];
  stack: string[];
  links: ProjectLink[];
  dependencies: string[];
  owner?: string;
  icon?: string;
  screenshots: string[];
  timeline: ProjectTimeline;
  progress?: number;
  isHub: boolean;
  position: ProjectPosition;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 생성·편집 시 입력으로 쓰는 부분 타입.
 * slug, name, category, status, description, position은 필수.
 * 나머지는 선택이고 기본값이 적용된다.
 */
export type ProjectInput = Pick<
  Project,
  "slug" | "name" | "category" | "status" | "description" | "position"
> &
  Partial<Omit<Project, "slug" | "createdAt" | "updatedAt">>;
