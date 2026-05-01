import { getDemoDataset } from "@/shared/mocks/demo-data";

export const DEMO_ACCOUNT_ID = "demo-workspace";
const DEMO_PROJECT_SLUG = "demo-indexer-10";

export function getDemoProjectsHref() {
  return "/projects";
}

export function getDemoHomeHref() {
  return "/";
}

export function getDemoProjectHref() {
  return `/project/${DEMO_PROJECT_SLUG}/`;
}

export interface DemoStats {
  workspaceName: string;
  totalProjects: number;
  totalHubs: number;
  totalNodes: number;
}

let demoStatsCache: DemoStats | null = null;

export function getDemoStats(): DemoStats {
  if (demoStatsCache) return demoStatsCache;
  const dataset = getDemoDataset();
  const totalHubs = dataset.projects.filter((p) => p.isHub).length;
  const totalNodes = dataset.projects.length - totalHubs;
  demoStatsCache = {
    workspaceName: 'oh-my-ontology',
    totalProjects: dataset.projects.length,
    totalHubs,
    totalNodes,
  };
  return demoStatsCache;
}
