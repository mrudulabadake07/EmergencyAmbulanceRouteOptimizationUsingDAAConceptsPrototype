// ============================================================================
// Breadth-First Search (BFS) — shortest path on an UNWEIGHTED graph.
// ============================================================================
//
// BFS explores nodes layer by layer. On an unweighted graph it finds the path
// with the fewest edges (hops). On a weighted graph it does NOT generally find
// the minimum-weight path, which is the point of the DAA comparison demo.

export interface BFSResult {
  /** dist[i] = fewest edges from source to i, or Infinity if unreachable. */
  dist: number[];
  /** prev[i] = previous node on the BFS tree path to i, or -1. */
  prev: number[];
  /** Ordered list of visited node ids, for visualization. */
  visitOrder: number[];
}

/**
 * Run BFS from a source node over the graph's adjacency list.
 *
 * Time complexity: O(V + E)  — each node and edge is processed at most once.
 * Space complexity: O(V).
 *
 * Data structures: a FIFO queue and a visited/dist array.
 */
export function bfs(graph: { nodes: number; edges: { to: number }[][] }, source: number): BFSResult {
  const { nodes, edges } = graph;
  const dist = new Array<number>(nodes).fill(Infinity);
  const prev = new Array<number>(nodes).fill(-1);
  const visitOrder: number[] = [];
  const queue: number[] = [];

  dist[source] = 0;
  queue.push(source);

  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    visitOrder.push(u);
    for (const edge of edges[u]) {
      if (dist[edge.to] === Infinity) {
        dist[edge.to] = dist[u] + 1;
        prev[edge.to] = u;
        queue.push(edge.to);
      }
    }
  }

  return { dist, prev, visitOrder };
}
