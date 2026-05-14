/**
 * 다중 선택 노드 정렬 — pure compute. UI / store 의존 0 → unit test 쉬움.
 *
 * 각 함수는 *현재* 노드 위치를 받아 *목표* 위치를 반환. 호출자가 ReactFlow
 * setNodes 와 vault.updateFrontmatter 둘 다 트리거해서 in-memory 와 frontmatter
 * 진실원을 동시에 갱신.
 *
 * Align: 같은 축에 줄세움 (좌/우/상/하/가운데).
 * Distribute: 첫·마지막 노드는 고정, 그 사이를 균등 간격.
 */

export interface AlignableNode {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export type AlignAction =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom"
  | "distribute-h"
  | "distribute-v";

/**
 * 액션을 적용. 변경된 노드만 결과 Map 에 담는다 (이미 align 위치인 노드는
 * skip — 불필요한 setNodes / vault patch 회피).
 *
 * distribute-h/v 는 노드 ≥ 3 필요. 2 개면 빈 Map (UI 가 알아서 disabled).
 */
export function computeAlignedPositions(
  nodes: AlignableNode[],
  action: AlignAction,
): Map<string, { x: number; y: number }> {
  if (nodes.length < 2) return new Map();
  const result = new Map<string, { x: number; y: number }>();

  switch (action) {
    case "left": {
      const minX = Math.min(...nodes.map((n) => n.position.x));
      for (const n of nodes) {
        if (n.position.x !== minX) {
          result.set(n.id, { x: minX, y: n.position.y });
        }
      }
      return result;
    }
    case "right": {
      const maxRight = Math.max(...nodes.map((n) => n.position.x + n.width));
      for (const n of nodes) {
        const targetX = maxRight - n.width;
        if (n.position.x !== targetX) {
          result.set(n.id, { x: targetX, y: n.position.y });
        }
      }
      return result;
    }
    case "center-x": {
      const centerX =
        nodes.reduce((s, n) => s + n.position.x + n.width / 2, 0) / nodes.length;
      for (const n of nodes) {
        const targetX = centerX - n.width / 2;
        if (n.position.x !== targetX) {
          result.set(n.id, { x: targetX, y: n.position.y });
        }
      }
      return result;
    }
    case "top": {
      const minY = Math.min(...nodes.map((n) => n.position.y));
      for (const n of nodes) {
        if (n.position.y !== minY) {
          result.set(n.id, { x: n.position.x, y: minY });
        }
      }
      return result;
    }
    case "bottom": {
      const maxBottom = Math.max(...nodes.map((n) => n.position.y + n.height));
      for (const n of nodes) {
        const targetY = maxBottom - n.height;
        if (n.position.y !== targetY) {
          result.set(n.id, { x: n.position.x, y: targetY });
        }
      }
      return result;
    }
    case "center-y": {
      const centerY =
        nodes.reduce((s, n) => s + n.position.y + n.height / 2, 0) / nodes.length;
      for (const n of nodes) {
        const targetY = centerY - n.height / 2;
        if (n.position.y !== targetY) {
          result.set(n.id, { x: n.position.x, y: targetY });
        }
      }
      return result;
    }
    case "distribute-h": {
      if (nodes.length < 3) return result;
      const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const spacing =
        (last.position.x - first.position.x) / (sorted.length - 1);
      sorted.forEach((n, i) => {
        const targetX = first.position.x + spacing * i;
        if (n.position.x !== targetX) {
          result.set(n.id, { x: targetX, y: n.position.y });
        }
      });
      return result;
    }
    case "distribute-v": {
      if (nodes.length < 3) return result;
      const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const spacing =
        (last.position.y - first.position.y) / (sorted.length - 1);
      sorted.forEach((n, i) => {
        const targetY = first.position.y + spacing * i;
        if (n.position.y !== targetY) {
          result.set(n.id, { x: n.position.x, y: targetY });
        }
      });
      return result;
    }
  }
}
