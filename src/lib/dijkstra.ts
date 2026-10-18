// ============================================================================
// Dijkstra's Algorithm — shortest path in a weighted graph.
// ============================================================================
//
// In a real road network the "weight" of each road segment is the travel time
// (seconds). Dijkstra's algorithm finds the path with the minimum total travel
// time from a source node to every other node.
//
// This file contains a GENUINE, independent implementation of Dijkstra's
// algorithm used for the in-app DAA demonstration graph. It is NOT used to
// compute the real road routes shown on the map — those come from the OSRM
// routing service. See `osrm.ts` for the real road routing.

export interface GraphEdge {
  to: number;
  /** Non-negative edge weight (e.g. travel time in seconds). */
  weight: number;
}

export interface Graph {
  nodes: number;
  /** Adjacency list: graph.edges[i] = list of edges from node i. */
  edges: GraphEdge[][];
}

export interface DijkstraResult {
  /** dist[i] = shortest distance from source to node i, or Infinity if unreachable. */
  dist: number[];
  /** prev[i] = previous node on the shortest path to i, or -1 if none. */
  prev: number[];
  /** Ordered list of visited node ids, for visualization. */
  visitOrder: number[];
  /** Number of edge relaxations performed — used in the complexity write-up. */
  relaxations: number;
}

// A simple binary-heap min-priority-queue keyed by node id.
// Keeping it internal avoids extra dependencies and keeps the code readable for
// a college DAA project.
class MinHeap {
  private heap: { id: number; key: number }[] = [];

  get size() {
    return this.heap.length;
  }

  push(id: number, key: number) {
    this.heap.push({ id, key });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: number; key: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  decreaseKey(id: number, key: number) {
    // Linear scan keeps the implementation simple; fine for small demo graphs.
    const idx = this.heap.findIndex((e) => e.id === id);
    if (idx !== -1 && key < this.heap[idx].key) {
      this.heap[idx].key = key;
      this.bubbleUp(idx);
    }
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[i].key < this.heap[parent].key) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  private bubbleDown(i: number) {
    const n = this.heap.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.heap[l].key < this.heap[smallest].key) smallest = l;
      if (r < n && this.heap[r].key < this.heap[smallest].key) smallest = r;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}

/**
 * Run Dijkstra's algorithm from a source node.
 *
 * Time complexity with a binary heap:
 *   O((V + E) log V)  where V = nodes, E = edges.
 * Space complexity: O(V + E).
 *
 * Data structures used:
 *   - dist[]  : array of shortest-distance estimates
 *   - prev[]  : array for path reconstruction
 *   - MinHeap : binary-heap priority queue keyed by distance
 */
export function dijkstra(graph: Graph, source: number): DijkstraResult {
  const { nodes, edges } = graph;
  const dist = new Array<number>(nodes).fill(Infinity);
  const prev = new Array<number>(nodes).fill(-1);
  const visited = new Array<boolean>(nodes).fill(false);
  const visitOrder: number[] = [];
  let relaxations = 0;

  const pq = new MinHeap();
  dist[source] = 0;
  pq.push(source, 0);

  while (pq.size > 0) {
    const { id: u } = pq.pop()!;
    if (visited[u]) continue;
    visited[u] = true;
    visitOrder.push(u);

    for (const edge of edges[u]) {
      relaxations++;
      // Relaxation step: can we improve the distance to edge.to via u?
      const alt = dist[u] + edge.weight;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = u;
        pq.push(edge.to, alt);
      }
    }
  }

  return { dist, prev, visitOrder, relaxations };
}

/**
 * Reconstruct the shortest path from source to target using prev[].
 * Returns an empty array if the target is unreachable from the source.
 */
export function reconstructPath(
  prev: number[],
  source: number,
  target: number,
): number[] {
  const path: number[] = [];
  // If the target was never reached, prev[target] stays -1 (unless it's the source).
  if (prev[target] === -1 && target !== source) return path;
  let cur = target;
  // Walk backwards from target to source.
  while (cur !== -1) {
    path.unshift(cur);
    if (cur === source) break;
    cur = prev[cur];
  }
  // If we never reached the source, the path is incomplete.
  if (path[0] !== source) return [];
  return path;
}
