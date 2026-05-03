import type Graph from 'graphology';
import type { SigmaEdgeAttrs, SigmaNodeAttrs } from './graph-build';

/**
 * 선택 노드 기준 BFS로 각 노드까지의 최단 거리(홉 수)를 계산.
 * undirected로 탐색 — 의존 방향과 상관없이 "연결돼 있으면" 이웃으로 본다.
 * 도달 불가 노드는 Map에 없음(= Infinity로 간주).
 */
export function computeDepthMap(
  graph: Graph<SigmaNodeAttrs, SigmaEdgeAttrs>,
  source: string | null | undefined,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!source || !graph.hasNode(source)) return result;

  result.set(source, 0);
  // BFS — head pointer 로 dequeue O(1). \`Array.shift()\` 는 O(n) 이라
  // 큰 그래프에서 O(n²) 회귀.
  const queue: string[] = [source];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const d = result.get(current) ?? 0;
    graph.forEachNeighbor(current, (neighbor) => {
      if (result.has(neighbor)) return;
      result.set(neighbor, d + 1);
      queue.push(neighbor);
    });
  }
  return result;
}

/**
 * BFS 기반 최단 경로 — source 부터 target 까지 undirected 경로를 돌려준다.
 * 미연결 시 null. depth-map 과 동일한 탐색 기준.
 */
export function shortestPath(
  graph: Graph<SigmaNodeAttrs, SigmaEdgeAttrs>,
  source: string,
  target: string,
): string[] | null {
  if (!graph.hasNode(source) || !graph.hasNode(target)) return null;
  if (source === target) return [source];
  const parent = new Map<string, string>();
  parent.set(source, source);
  const queue: string[] = [source];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    if (current === target) break;
    graph.forEachNeighbor(current, (neighbor) => {
      if (parent.has(neighbor)) return;
      parent.set(neighbor, current);
      queue.push(neighbor);
    });
  }
  if (!parent.has(target)) return null;
  const path: string[] = [];
  let cursor = target;
  while (cursor !== source) {
    path.push(cursor);
    cursor = parent.get(cursor) ?? source;
  }
  path.push(source);
  path.reverse();
  return path;
}
