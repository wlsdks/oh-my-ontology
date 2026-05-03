import { describe, expect, it } from "vitest";
import {
  ONTOLOGY_STARTER_FILES,
  buildMcpConfigJson,
} from "./ontology-starter";

describe("ONTOLOGY_STARTER_FILES", () => {
  it("5 시드 파일 제공 — README + project + 3 example (domain/capability/element)", () => {
    expect(ONTOLOGY_STARTER_FILES).toHaveLength(5);
    const paths = ONTOLOGY_STARTER_FILES.map((f) => f.relPath);
    expect(paths).toContain("README.md");
    expect(paths).toContain("project.md");
    expect(paths).toContain("domains/example.md");
    expect(paths).toContain("capabilities/example.md");
    expect(paths).toContain("elements/example.md");
  });

  it("모든 파일이 frontmatter 시작 (---) + kind 키 포함", () => {
    for (const f of ONTOLOGY_STARTER_FILES) {
      expect(f.content.startsWith("---\n")).toBe(true);
      expect(f.content).toMatch(/^kind:\s/m);
    }
  });

  it("3 example 파일은 정확히 1 줄로 example slug 가짐 (도메인/역량/요소 컨벤션)", () => {
    const example = ONTOLOGY_STARTER_FILES.find(
      (f) => f.relPath === "domains/example.md",
    );
    expect(example?.content).toMatch(/^slug:\s+domains\/example/m);
  });
});

describe("buildMcpConfigJson", () => {
  it("MCP server 'oh-my-ontology' 항목과 OMOT_VAULT env placeholder 포함", () => {
    const json = buildMcpConfigJson("my-vault");
    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      mcpServers: {
        "oh-my-ontology": {
          command: "npx",
          args: ["-y", "oh-my-ontology-mcp"],
          env: {
            OMOT_VAULT: "<absolute path to your my-vault folder>",
          },
        },
      },
    });
  });

  it("vaultName 이 문자 그대로 placeholder 안에 박힘", () => {
    expect(buildMcpConfigJson("foo")).toContain("your foo folder");
    expect(buildMcpConfigJson("한글-vault")).toContain("your 한글-vault folder");
  });

  it("출력 끝에 newline 추가 (편집기 친화)", () => {
    expect(buildMcpConfigJson("v")).toMatch(/\n$/);
  });

  it("2-space 들여쓰기로 pretty-print", () => {
    const json = buildMcpConfigJson("v");
    expect(json).toContain("  \"mcpServers\":");
    expect(json).toContain("    \"oh-my-ontology\":");
  });
});
