// A small weighted graph used for the in-app Dijkstra vs BFS demonstration.
//
// Nodes 0..8 represent a toy road network. Edge weights model travel time in
// seconds (e.g. longer roads or slower streets have larger weights). This is a
// standalone pedagogical graph — it is independent of the real OSRM road
// routes shown on the map.

import type { Graph } from "./dijkstra";

// Node labels for the demo graph.
export const DEMO_NODE_LABELS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I",
];

// Each tuple: [from, to, weight]. Edges are undirected (added both ways).
const RAW_EDGES: [number, number, number][] = [
  [0, 1, 4],   // A - B  4s
  [0, 2, 2],   // A - C  2s
  [1, 2, 1],   // B - C  1s
  [1, 3, 5],   // B - D  5s
  [2, 3, 8],   // C - D  8s
  [2, 4, 10],  // C - E 10s
  [3, 4, 2],   // D - E  2s
  [3, 5, 6],   // D - F  6s
  [4, 5, 3],   // E - F  3s
  [4, 6, 7],   // E - G  7s
  [5, 6, 1],   // F - G  1s
  [5, 7, 2],   // F - H  2s
  [6, 8, 4],   // G - I  4s
  [7, 8, 3],   // H - I  3s
];

export function buildDemoGraph(): Graph {
  const nodes = DEMO_NODE_LABELS.length;
  const edges: { to: number; weight: number }[][] = Array.from(
    { length: nodes },
    () => [],
  );
  for (const [u, v, w] of RAW_EDGES) {
    edges[u].push({ to: v, weight: w });
    edges[v].push({ to: u, weight: w });
  }
  return { nodes, edges };
}

// A simple unweighted view of the same graph, for the BFS comparison.
export function buildDemoGraphUnweighted() {
  const g = buildDemoGraph();
  return {
    nodes: g.nodes,
    edges: g.edges.map((adj) => adj.map((e) => ({ to: e.to }))),
  };
}
