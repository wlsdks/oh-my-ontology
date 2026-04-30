import { describe, expect, it } from "vitest";
import type { Project } from "../../../entities/project/model/types";
import { SEED_PROJECTS } from "../../../entities/project/model/seed-data";
import { resolveFeaturedPathPresets } from "./presets";

function toProject(
  input: (typeof SEED_PROJECTS)[number],
  index: number,
): Project {
  return {
    slug: input.slug,
    name: input.name,
    nameEn: input.nameEn,
    category: input.category,
    status: input.status,
    description: input.description,
    detail: input.detail,
    tags: input.tags ?? [],
    stack: input.stack ?? [],
    links: input.links ?? [],
    dependencies: input.dependencies ?? [],
    owner: input.owner,
    icon: input.icon,
    screenshots: input.screenshots ?? [],
    timeline: input.timeline ?? {},
    progress: input.progress,
    isHub: input.isHub ?? false,
    position: input.position,
    createdAt: new Date(2026, 3, 14, 0, index),
    updatedAt: new Date(2026, 3, 14, 0, index),
  };
}

describe("resolveFeaturedPathPresets", () => {
  it("returns the intended presets when matching projects exist", () => {
    const presets = resolveFeaturedPathPresets(SEED_PROJECTS.map(toProject));

    expect(presets.map((preset) => preset.id)).toEqual([
      "identity",
      "agent",
      "products",
    ]);
  });

  it("filters presets whose anchor project is missing", () => {
    const presets = resolveFeaturedPathPresets(
      SEED_PROJECTS.filter((project) => project.slug !== "reactor").map(
        toProject,
      ),
    );

    expect(presets.map((preset) => preset.id)).toEqual([
      "identity",
      "products",
    ]);
  });

  it("resolves ordered steps and highlight slugs from live project data", () => {
    const presets = resolveFeaturedPathPresets(SEED_PROJECTS.map(toProject));
    const identity = presets.find((preset) => preset.id === "identity");

    expect(identity?.steps.map((step) => step.slug)).toEqual([
      "iam",
      "sample",
      "sample-app",
      "pick",
    ]);
    expect(identity?.steps.map((step) => step.label)).toEqual([
      "IAM",
      "Demo",
      "커뮤니티 (Sample App)",
      "Sample Live Lecture (Sample)",
    ]);
    expect(identity?.highlightSlugs).toContain("sample-news");
  });

  it("drops steps and highlight targets that are missing from the current dataset", () => {
    const presets = resolveFeaturedPathPresets(
      SEED_PROJECTS.filter((project) => !["pick", "sample-news"].includes(project.slug)).map(
        toProject,
      ),
    );
    const identity = presets.find((preset) => preset.id === "identity");

    expect(identity?.steps.map((step) => step.slug)).toEqual([
      "iam",
      "sample",
      "sample-app",
    ]);
    expect(identity?.highlightSlugs).not.toContain("pick");
    expect(identity?.highlightSlugs).not.toContain("sample-news");
  });
});
