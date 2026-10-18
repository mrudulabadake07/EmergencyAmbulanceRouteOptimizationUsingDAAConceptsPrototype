# Emergency Ambulance Route Optimization System

An educational web prototype that helps visualize how an ambulance dispatcher
could find an efficient road route to a patient and then to the nearest suitable
hospital. It demonstrates core **Design and Analysis of Algorithms (DAA)**
concepts: **Dijkstra's algorithm**, **greedy selection**, **time complexity**,
and an **algorithm comparison** (Dijkstra vs BFS).

> **Disclaimer:** This is an educational prototype. It does **not** contact real
> emergency services or dispatch ambulances. Public map, routing (OSRM), and
> geocoding (Nominatim) services have limitations and may be unavailable.
> Estimated times are advisory only and are **not** certified for real
> emergency response.

---

## Features

- **Interactive OpenStreetMap** (via Leaflet) — click the map or search an
  address to set the ambulance start and patient location.
- **Real road routing** using the public **OSRM** service, with estimated
  distance and travel time.
- **Hospital discovery** from OpenStreetMap data (Overpass API), plus manual
  entry.
- **Nearest-hospital recommendation** using greedy selection over estimated
  travel times.
- **Alternative hospital list** — sort and switch routes interactively.
- **Emergency dashboard** with ambulance/patient/hospital, distance, time,
  hospitals evaluated, selected algorithm, and route status.
- **DAA algorithm panel** with a live Dijkstra demo on a weighted graph and a
  Dijkstra-vs-BFS comparison.
- **Sample demonstration data** so the app can be tried without typing real
  addresses.
- Responsive blue-and-white emergency-service theme.

> Note: the real road routes shown on the map are computed by the OSRM routing
> service. The Dijkstra / BFS implementation in this app runs on a standalone
> demo graph for the DAA demonstration and is **not** claimed to produce the
> OSRM routes.

---

## Technologies

- **React + TypeScript + Vite**
- **Leaflet** + OpenStreetMap tiles for the map
- **OSRM** (public demo server) for road routes and travel times
- **Nominatim** for address search / reverse geocoding
- **Overpass API** for hospital discovery from OpenStreetMap
- **Tailwind CSS** for styling, **lucide-react** for icons

No paid APIs are required for the basic demonstration. All services used are
public and free for light, non-commercial, educational use (and may be rate
limited or occasionally unavailable).

---

## Getting started (beginner friendly)

You need [Node.js](https://nodejs.org/) version 18 or newer installed.

1. Open a terminal in this project folder.
2. Install the dependencies once:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   Then open the URL shown in the terminal (usually `http://localhost:5173`).

4. To create a production build:

   ```bash
   npm run build
   ```

   The built site is placed in the `dist/` folder. You can preview it with:

   ```bash
   npm run preview
   ```

---

## How to use

1. Click **Use Sample Data** to load demonstration ambulance, patient, and
   hospital locations (Bengaluru, India). This is the quickest way to try it.
2. Alternatively, set locations yourself:
   - Use **Pick on map** next to Ambulance / Patient, then click the map; or
   - Type an address and click **Find**.
3. Click **Find Route** to compute the road route from the ambulance to the
   patient.
4. Click **Find Nearest Hospital** to compute routes from the patient to every
   hospital and recommend the one with the shortest estimated travel time.
5. Click any hospital in **Alternative Hospitals** to view its route on the map.
6. Use **Auto-discover nearby** in the Hospitals panel to fetch real hospitals
   from OpenStreetMap around the first hospital, or add one manually.
7. Explore the **DAA Algorithms Explained** panel to run Dijkstra and compare it
   with BFS on the demo graph.
8. Click **Reset** to clear everything.

---

## How the DAA concepts are implemented

### 1. Dijkstra's algorithm (`src/lib/dijkstra.ts`)

A genuine, independent implementation of Dijkstra's algorithm on a weighted
graph using a binary-heap min-priority queue.

- Edge weights represent **travel time** (seconds) — the quantity we minimize.
- Data structures: a distance array, a predecessor array, a min-heap priority
  queue, and an adjacency list.
- **Time complexity:** `O((V + E) log V)` with the binary heap.
- The demo graph (`src/lib/sampleGraph.ts`) has 9 nodes and 14 weighted edges;
  you can pick any source and target in the UI to see the shortest path, the
  visit order, and the number of edge relaxations.

### 2. Greedy selection (`src/App.tsx`, "Find Nearest Hospital")

After routes to every hospital are evaluated, the app picks the hospital with
the **smallest estimated travel time** among the successfully evaluated ones.
This is a greedy best-first selection: at the decision step, choose the locally
best candidate — which here is also globally optimal because we compare all
candidates.

### 3. Time complexity

Shown in the UI alongside the Dijkstra demo. The complexity comes from:
- One extract-min per node: `O(V log V)`
- One decrease-key / push per edge relaxation: `O(E log V)`
- Total: `O((V + E) log V)`

### 4. Algorithm comparison: Dijkstra vs BFS (`src/lib/bfs.ts`, `AlgorithmPanel`)

BFS finds the path with the **fewest edges (hops)** on an unweighted graph in
`O(V + E)`. The comparison panel runs both algorithms on the same graph and
shows that BFS can return a path with a **larger total travel time** than
Dijkstra's, because it ignores edge weights. This illustrates why BFS is **not
appropriate** for minimizing travel time on weighted road networks.

---

## Error handling

- Missing ambulance or patient location → a clear message asks the user to set
  it first.
- Invalid coordinates → rejected before routing.
- OSRM unreachable or returns no route → the route status and a human-readable
  message are shown; no distance or time is invented.
- No hospitals available → the user is told to add or discover hospitals.
- Hospital discovery (Overpass) failure → a message suggests adding hospitals
  manually.

All estimated values are clearly labelled as estimates.

---

## Project structure

```
src/
  App.tsx                      # Main app, state, and routing actions
  components/
    MapView.tsx                # Leaflet map, markers, route polylines
    LocationPanel.tsx          # Ambulance/patient entry + action buttons
    DashboardPanel.tsx         # Emergency dashboard + hospital list
    HospitalPanel.tsx          # Hospital discovery + manual entry
    AlgorithmPanel.tsx         # DAA explanation + Dijkstra/BFS demo
  lib/
    types.ts                   # Shared TypeScript types
    dijkstra.ts                # Dijkstra implementation (weighted graph)
    bfs.ts                     # BFS implementation (unweighted graph)
    sampleGraph.ts             # Demo graph for the algorithm panel
    osrm.ts                    # OSRM routing wrapper + formatters
    geocode.ts                 # Nominatim geocoding/reverse-geocoding
    hospitals.ts               # Overpass discovery + sample data
```
