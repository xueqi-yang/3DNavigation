# Telecom Paris — 3D Indoor Navigation

A web-based 3D indoor navigation system for the Telecom Paris building, built with Vue 3 and Three.js.

This project extends and improves upon a previous navigation prototype by introducing real-time dynamic pathfinding, an elevator simulation system, multi-destination routing, and accessibility support.

---

## Features

### 3D Navigation
- Interactive 3D model of the Telecom Paris building (5 floors)
- Movable agent that walks along computed paths
- Floor-by-floor opacity management — active floor is highlighted, others fade out
- Orbit controls: rotate, zoom, and pan the camera freely

### Pathfinding
- Navigation mesh (navmesh) based pathfinding using `three-pathfinding`
- **String Pulling** optimization: removes redundant waypoints so the agent takes the most direct path possible
- Multi-floor routing: automatically plans routes through stairs or elevator depending on availability and mode
- **D\* Lite dynamic replanning**: if the elevator changes state (opens or closes) while the agent is navigating, the route is instantly recalculated

### Elevator System
- Each floor has an independent elevator with its own open/close cycle (different durations per floor)
- Animated elevator cab that moves up and down the shaft when the agent changes floors
- Agent disappears inside the cab during the ride and reappears on the destination floor
- Real-time door open/close animation with a visual glow indicator

### Search & Routing
- Search bar to find any destination by name or category (classroom, lab, office, restroom, etc.)
- 30+ navigable destinations across all 5 floors
- **Multi-waypoint routing**: add multiple destinations and the agent visits them in order
- Path preview (shown as a yellow line) before navigation starts — confirm before the agent moves
- One-click navigation by clicking directly on the 3D scene

### Accessibility
- **Wheelchair mode**: restricts routing to elevator-only paths, avoiding all staircases
- Destinations marked as inaccessible are hidden in wheelchair mode

---

## Technical Stack

| Technology | Role |
|---|---|
| Vue 3 (Composition API) | UI components and reactive state |
| Three.js | 3D rendering and scene management |
| three-pathfinding | Navmesh-based A\* pathfinding |
| Vite | Development server and build tool |

---

## Project Structure

```
src/
├── App.vue                  # Main component — all UI (search, waypoints, floor selector)
├── main.js                  # Vue entry point
└── systems/
    ├── useScene.js          # Three.js composable — scene, camera, agent, render loop
    ├── pathfinder.js        # Pathfinding logic — multi-floor routing, D* Lite, String Pulling
    ├── elevator.js          # Elevator system — independent timers, cab animation, door state
    └── destinations.js      # All navigable destinations with coordinates and metadata

public/
└── glb/
    ├── building/
    │   ├── floor1.glb ... floor5.glb   # Building floor models
    ├── building_navmesh.gltf            # Navigation mesh
    ├── door.glb / door2.glb / door3.glb # Door models
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone <repository-url>
cd 3D-Navigation
npm install
```

### Run in development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build
```

---

## How to Use

1. **Search** for a destination in the search bar (e.g. "lab", "room 201", "cafeteria")
2. **Click a result** to add it to your route
3. Add more destinations to create a multi-stop route
4. Click **Preview** to see the full route shown as a yellow line
5. Click **Start** to begin navigation
6. Use **Wheelchair mode** to restrict routes to elevator-only paths
7. Use the **floor buttons** to focus the camera on a specific floor
8. **Click anywhere** on the 3D scene to navigate directly to that point

---

## Algorithms & References

### String Pulling
Removes redundant intermediate waypoints from the A\* path. If the agent can walk directly from point A to point C without leaving the navmesh, point B is skipped. This produces shorter, more natural-looking paths.

> Mononen, M. (2009). *Simple Stupid Funnel Algorithm*

### D\* Lite Dynamic Replanning
When the elevator state changes mid-journey (door closes while agent is heading to the elevator), D\* Lite triggers an immediate replan. The new path is computed from the agent's current position and either reroutes via stairs or switches back to the elevator.

> Koenig, S. & Likhachev, M. (2002). *D\* Lite*. AAAI.

### Multi-locomotion Pathfinding
Wheelchair mode implements accessibility-aware routing by flagging staircase nodes as inaccessible and restricting vertical transitions to elevator-only paths.

> Karimi, H. A. et al. (2022). *Weighted Octree-based 3D Indoor Pathfinding for Multiple Locomotion Types*. ScienceDirect.

---

## Improvements Over Previous Work

| Feature | Previous project | This project |
|---|---|---|
| Navigable destinations | 3 doors | 30+ rooms, labs, offices, facilities |
| Search | Dropdown list | Full text search by name or category |
| Multi-destination | Not supported | Ordered waypoint queue |
| Path preview | None | Yellow preview line before navigation |
| Elevator | None | Animated cab, independent per-floor timers |
| Dynamic replanning | None | D\* Lite replan on elevator state change |
| Accessibility | None | Wheelchair mode (elevator-only routing) |
| Path optimization | None | String Pulling |
