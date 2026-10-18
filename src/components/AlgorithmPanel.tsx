import { useMemo, useState } from "react";
import { Code2, GitCompare, Info, Network } from "lucide-react";
import { dijkstra, reconstructPath } from "@/lib/dijkstra";
import { bfs } from "@/lib/bfs";
import {
  buildDemoGraph,
  buildDemoGraphUnweighted,
  DEMO_NODE_LABELS,
} from "@/lib/sampleGraph";

type Tab = "dijkstra" | "comparison";

export default function AlgorithmPanel() {
  const [tab, setTab] = useState<Tab>("dijkstra");
  const [source, setSource] = useState(0);
  const [target, setTarget] = useState(8);

  const graph = useMemo(() => buildDemoGraph(), []);
  const unweighted = useMemo(() => buildDemoGraphUnweighted(), []);

  const dijkstraRes = useMemo(
    () => dijkstra(graph, source),
    [graph, source],
  );
  const dijkstraPath = useMemo(
    () => reconstructPath(dijkstraRes.prev, source, target),
    [dijkstraRes, source, target],
  );
  const dijkstraPathLabels = dijkstraPath.map((n) => DEMO_NODE_LABELS[n]).join(" → ");

  const bfsRes = useMemo(() => bfs(unweighted, source), [unweighted, source]);
  const bfsPath = useMemo(() => {
    // Reconstruct BFS path from prev[].
    const path: number[] = [];
    let cur = target;
    if (bfsRes.prev[cur] === -1 && cur !== source) return path;
    while (cur !== -1) {
      path.unshift(cur);
      if (cur === source) break;
      cur = bfsRes.prev[cur];
    }
    return path[0] === source ? path : [];
  }, [bfsRes, source, target]);
  const bfsPathLabels = bfsPath.map((n) => DEMO_NODE_LABELS[n]).join(" → ");

  // Compute total weight of a path through the weighted graph.
  const pathWeight = (path: number[]): number => {
    if (path.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges[path[i]].find((e) => e.to === path[i + 1]);
      if (edge) total += edge.weight;
    }
    return total;
  };

  const dijkstraWeight = pathWeight(dijkstraPath);
  const bfsWeight = pathWeight(bfsPath);

  return (
    <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-sky-800">
        <Network size={16} /> DAA Algorithms Explained
      </h2>

      {/* Tab switcher */}
      <div className="mt-3 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setTab("dijkstra")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            tab === "dijkstra" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500"
          }`}
        >
          <Code2 size={13} /> Dijkstra
        </button>
        <button
          type="button"
          onClick={() => setTab("comparison")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            tab === "comparison" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500"
          }`}
        >
          <GitCompare size={13} /> Dijkstra vs BFS
        </button>
      </div>

      {tab === "dijkstra" ? (
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p>
            <b>Dijkstra's algorithm</b> finds the shortest path in a graph whose
            edge weights are non-negative. Here, each edge weight is the{" "}
            <b>travel time</b> (seconds) along a road segment, so the algorithm
            minimizes the total travel time from the ambulance to a destination.
          </p>
          <div className="rounded-md bg-sky-50 p-3 text-xs">
            <p className="font-semibold text-sky-800">How it works</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sky-900">
              <li>Set the distance to every node to &infin;, and the source to 0.</li>
              <li>Put the source into a min-priority queue keyed by distance.</li>
              <li>Pop the closest unvisited node u.</li>
              <li>
                <b>Relax</b> each edge u→v: if dist[u] + weight &lt; dist[v],
                update dist[v] and remember u as v's predecessor.
              </li>
              <li>Repeat until the queue is empty.</li>
            </ol>
          </div>
          <div className="rounded-md bg-gray-50 p-3 text-xs">
            <p className="font-semibold text-gray-700">Time complexity</p>
            <p className="mt-1">
              With a binary-heap priority queue:{" "}
              <code className="rounded bg-gray-200 px-1">O((V + E) log V)</code>,
              where V = nodes and E = edges.
            </p>
            <p className="mt-1">
              <b>Data structures:</b> distance array, predecessor array, a
              min-heap priority queue, and an adjacency list for the graph.
            </p>
          </div>

          <div className="rounded-md border border-sky-100 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Try it on the demo graph (9 nodes, 14 weighted edges)
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                From:
                <select
                  value={source}
                  onChange={(e) => setSource(Number(e.target.value))}
                  className="rounded border border-gray-300 px-1.5 py-1"
                >
                  {DEMO_NODE_LABELS.map((l, i) => (
                    <option key={i} value={i}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                To:
                <select
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="rounded border border-gray-300 px-1.5 py-1"
                >
                  {DEMO_NODE_LABELS.map((l, i) => (
                    <option key={i} value={i}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-2 rounded bg-sky-50 p-2 text-xs text-sky-900">
              <p><b>Shortest path:</b> {dijkstraPathLabels || "unreachable"}</p>
              <p><b>Total travel time:</b> {dijkstraWeight}s</p>
              <p className="mt-1 text-sky-700">
                Nodes visited in order:{" "}
                {dijkstraRes.visitOrder.map((n) => DEMO_NODE_LABELS[n]).join(" → ")}
              </p>
              <p className="text-sky-700">
                Edge relaxations performed: {dijkstraRes.relaxations}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm text-gray-700">
          <p>
            <b>BFS</b> (Breadth-First Search) finds the path with the{" "}
            <b>fewest edges (hops)</b> on an <b>unweighted</b> graph. It ignores
            edge weights entirely, so on a weighted road network it will often
            return a path whose total travel time is <b>larger</b> than
            Dijkstra's.
          </p>
          <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Why BFS is not appropriate for travel time</p>
            <p className="mt-1">
              BFS treats every road as equally costly. A short hop on a slow,
              congested street is counted the same as a long stretch of fast
              highway. Dijkstra accounts for the actual travel time of each
              segment, so it is the correct choice for minimizing time.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <p className="font-semibold text-sky-800">Dijkstra (weighted)</p>
              <p className="mt-1 text-sky-900">Path: {dijkstraPathLabels || "unreachable"}</p>
              <p className="text-sky-900">Travel time: {dijkstraWeight}s</p>
              <p className="mt-1 text-sky-700">Complexity: O((V+E) log V)</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="font-semibold text-gray-700">BFS (unweighted)</p>
              <p className="mt-1 text-gray-800">Path: {bfsPathLabels || "unreachable"}</p>
              <p className="text-gray-800">Travel time: {bfsWeight}s</p>
              <p className="mt-1 text-gray-600">Complexity: O(V+E)</p>
            </div>
          </div>

          {bfsWeight > dijkstraWeight && (
            <div className="flex items-start gap-1.5 rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Dijkstra saved <b>{bfsWeight - dijkstraWeight}s</b> versus BFS on
                the same graph — even though BFS found a path with fewer hops.
                That is exactly why Dijkstra is the right algorithm for weighted
                road networks.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
