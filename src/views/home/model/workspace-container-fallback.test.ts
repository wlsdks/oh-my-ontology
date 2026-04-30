import { describe, expect, it } from "vitest";
import type { Project } from "@/entities/project";
import {
  deriveWorkspaceProjectContainers,
  inferWorkspaceProjectGroup,
} from "./workspace-container-fallback";

function project(overrides: Partial<Project> & Pick<Project, "slug" | "name">): Project {
  return {
    category: "system",
    status: "developing",
    description: "",
    tags: [],
    stack: [],
    links: [],
    dependencies: [],
    screenshots: [],
    timeline: {},
    isHub: false,
    position: { x: 0, y: 0 },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("inferWorkspaceProjectGroup", () => {
  it("uses explicit workspaceProjectId before legacy name fallback", () => {
    expect(
      inferWorkspaceProjectGroup(
        project({
          slug: "demo-ingest-classifier",
          name: "Demo Ingest · Classifier",
          workspaceProjectId: "ingest",
        }),
      ),
    ).toEqual({ id: "ingest", name: "Demo Ingest" });
  });

  it("infers a container from the legacy display name prefix", () => {
    expect(
      inferWorkspaceProjectGroup(
        project({
          slug: "demo-billing-cache",
          name: "Demo Billing · Cache",
        }),
      ),
    ).toEqual({ id: "demo-billing", name: "Demo Billing" });
  });
});

describe("deriveWorkspaceProjectContainers", () => {
  it("groups legacy flat hubs and nodes into project containers", () => {
    const containers = deriveWorkspaceProjectContainers(
      [
        project({
          slug: "demo-ingest-classifier",
          name: "Demo Ingest · Classifier",
          isHub: true,
        }),
        project({
          slug: "demo-ingest-parser",
          name: "Demo Ingest · Parser",
        }),
        project({
          slug: "demo-billing-cache",
          name: "Demo Billing · Cache",
          isHub: true,
        }),
      ],
      "account-1",
    );

    expect(containers.map((container) => container.id)).toEqual([
      "demo-ingest",
      "demo-billing",
    ]);
    expect(containers[0]).toMatchObject({
      name: "Demo Ingest",
      accountId: "account-1",
      description: "기존 프로젝트 목록에서 추론한 프로젝트 컨테이너",
      hubCount: 1,
      nodeCount: 1,
    });
  });
});
