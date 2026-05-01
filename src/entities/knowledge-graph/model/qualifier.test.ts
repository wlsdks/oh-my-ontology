import { describe, expect, it } from "vitest";
import { fromFirestoreKnowledgeGraphEdge } from "./mapper";

const BASE = {
  from: "project:foo",
  to: "domain:bar",
  type: "describes",
  projectIds: ["foo"],
  evidenceIds: [],
  lastApprovedAt: new Date("2026-05-01T00:00:00Z"),
  lastApprovedBy: "tester",
};

describe("V1.1 qualifiers + rank — fromFirestoreKnowledgeGraphEdge", () => {
  it("legacy edge (qualifiers + rank 미포함) → 둘 다 undefined", () => {
    const edge = fromFirestoreKnowledgeGraphEdge("e1", BASE);
    expect(edge.qualifiers).toBeUndefined();
    expect(edge.rank).toBeUndefined();
  });

  it("rank='preferred' 정상 인식, 'invalid' 는 undefined 폴백", () => {
    const a = fromFirestoreKnowledgeGraphEdge("e1", { ...BASE, rank: "preferred" });
    expect(a.rank).toBe("preferred");
    const b = fromFirestoreKnowledgeGraphEdge("e1", { ...BASE, rank: "invalid" });
    expect(b.rank).toBeUndefined();
  });

  it("qualifiers — string / time / quantity / nodeRef 4 종 모두 인식", () => {
    const edge = fromFirestoreKnowledgeGraphEdge("e1", {
      ...BASE,
      qualifiers: [
        { propertyId: "via", value: { kind: "string", raw: "REST" } },
        {
          propertyId: "since",
          value: { kind: "time", iso: "2024-01-01", precision: "day" },
        },
        {
          propertyId: "throughput",
          value: { kind: "quantity", value: 100, unit: "rps" },
        },
        {
          propertyId: "owner",
          value: { kind: "nodeRef", nodeId: "person:alice" },
        },
      ],
    });
    expect(edge.qualifiers).toHaveLength(4);
    expect(edge.qualifiers?.[0]).toEqual({
      propertyId: "via",
      value: { kind: "string", raw: "REST" },
    });
    expect(edge.qualifiers?.[2].value).toEqual({
      kind: "quantity",
      value: 100,
      unit: "rps",
    });
  });

  it("qualifiers 의 invalid 항목은 silently drop, 빈 배열이면 undefined", () => {
    const a = fromFirestoreKnowledgeGraphEdge("e1", {
      ...BASE,
      qualifiers: [
        { propertyId: "ok", value: { kind: "string", raw: "yes" } },
        { propertyId: 123, value: { kind: "string", raw: "no-id-not-string" } },
        { propertyId: "no-value-shape", value: { kind: "unknown" } },
        null,
        "not-an-object",
      ],
    });
    expect(a.qualifiers).toHaveLength(1);
    expect(a.qualifiers?.[0].propertyId).toBe("ok");

    const b = fromFirestoreKnowledgeGraphEdge("e1", {
      ...BASE,
      qualifiers: [{ propertyId: "x", value: "raw-string" }],
    });
    expect(b.qualifiers).toBeUndefined();
  });

  it("qualifiers 가 array 가 아니면 undefined", () => {
    const edge = fromFirestoreKnowledgeGraphEdge("e1", {
      ...BASE,
      qualifiers: { propertyId: "via", value: { kind: "string", raw: "x" } },
    });
    expect(edge.qualifiers).toBeUndefined();
  });
});
