# 3D Map and Navigation Interface for Telecom Paris

A web-based 3D indoor navigation prototype for Telecom Paris building. The project provides interactive route preview, elevator-versus-stairs routing, distance-based and time-based route recommendation, and multi-destination navigation.

Live preview: [https://xueqi-yang.github.io/3DNavigation/](https://xueqi-yang.github.io/3DNavigation/)

This project is further developed based on [saarzhanova/Navigation-Telecom](https://github.com/saarzhanova/Navigation-Telecom). It uses the base floor 3D models from that project as the spatial foundation.

On top of that foundation, this project rebuilds the application structure with Vue, adds a procedurally constructed elevator model, redesigns the routing logic, and implements more advanced interactions such as route preview, elevator/stair decision-making, and multi-waypoint navigation.

## Development Environment
Node.js v20.20.2
Vue 3
Three.js

## Features

### Interactive 3D Navigation

- Load and display a multi-floor 3D building model.
- Rotate, zoom, and pan the scene with orbit controls.
- Highlight the active floor while fading other floors.
- Focus the camera on a selected floor.
- Display a movable agent that follows the computed route.

### Route Planning

Route planning is designed as a complete interaction flow:

1. **Select a destination**
   - Users click directly on the 3D navmesh to select a destination.
   - The selected point becomes a waypoint.
   - Clicking an invalid or empty area clears the current selection.

2. **Preview route options**
   - The system previews the route before the agent starts moving.
   - Two route options are shown:
     - Distance route.
     - Time route.
   - The currently selected recommendation mode is highlighted in white.

3. **Choose a recommendation strategy**
   - The user can choose between:
     - **Distance-based recommendation**
     - **Time-based recommendation**
   - Both strategies compare elevator and stair alternatives when the destination is on a different floor.

4. **Add multiple waypoints**
   - Users can add multiple destinations through 'Add destination' button.
   - Each waypoint has a stable identity label, such as `Point A` or `Point B`.
   - Floating markers show both visit order and identity:

   ```txt
   1A = first destination, Point A
   2B = second destination, Point B
   ```

5. **Reorder and recalculate**
   - Waypoints can be reordered by dragging the handle in the left panel.
   - After reordering, both the distance route and time route are recalculated.
   - The route always starts from the current agent position and follows the waypoint order.

## Routing Logic

The routing logic is implemented in `src/systems/pathfinder.js`.

The system uses navmesh-based A* pathfinding for all walking segments. When the route crosses floors, the system compares:

```txt
1. Stair route
2. Elevator route
```

### Stair Route

The stair route is calculated as a continuous A* path on the navmesh:

```txt
agent position -> stair area -> target floor -> destination
```

Because the stairs are part of the navmesh geometry, A* can compute the route directly.

### Elevator Route

The elevator is treated as a special vertical transition, not as a normal walking surface.

The route is split into:

```txt
agent position
-> elevator navigation point on current floor
-> elevator ride
-> elevator navigation point on target floor
-> destination
```

## Distance-Based Route Recommendation

The distance strategy compares how much walking distance the user needs.

Elevator route distance:

```txt
d1 =
distance from agent to elevator navigation point
+ distance from target-floor elevator navigation point to destination
```

Stair route distance:

```txt
d2 =
full A* path distance through the stair route
```

Decision rule:

```txt
if d1 < d2 -> choose elevator
if d1 > d2 -> choose stairs
if d1 == d2 -> use current elevator door state as a tie-breaker
```

## Time-Based Route Recommendation

The time strategy converts both route alternatives into estimated travel time.

### Elevator Time

```txt
elevator time =
walking time outside elevator
+ elevator waiting time
+ boarding time
+ elevator ride time
+ exit time
```

### Stair Time

```txt
stair time =
stair route walking time
+ vertical movement penalty
```

### Time Model Parameters

The current implementation uses the following assumptions:

| Parameter | Value | Meaning |
|---|---:|---|
| Walking speed | 1.4 cene units/s | Used to convert walking distance to walking time |
| Elevator arrival time per floor | 3 s/floor | Time for the cab to reach the user's current floor |
| Elevator boarding time | 4 s | Time for entering the elevator and door operation before movement |
| Elevator ride time per floor | 4 s/floor | Time for vertical elevator travel |
| Elevator exit time | 2 s | Time for leaving the elevator |
| Upstairs extra penalty | 8 s/floor | Additional cost for walking upstairs |
| Downstairs extra penalty | 5 s/floor | Additional cost for walking downstairs |

Decision rule:

```txt
if elevator time < stair time -> choose elevator
if elevator time > stair time -> choose stairs
if elevator time == stair time -> use current elevator door state as a tie-breaker
```

## Elevator System

The elevator is implemented in `src/systems/elevator.js`.

It is constructed procedurally in Three.js so that its state can be controlled directly by the navigation system.

### Geometry Construction

The elevator consists of several generated objects:

- **Shaft walls**: built with transparent `BoxGeometry` meshes to show the vertical elevator area.
- **Elevator cab**: built with a `BoxGeometry` mesh that moves vertically between floors.
- **Door frames**: placed on each floor at the elevator entrance.
- **Door panels**: left and right door meshes that move apart when the door is open.
- **Glow indicator**: an emissive transparent panel showing the currently open elevator door.
- **Floor labels**: `Sprite` labels created from canvas textures, such as `F1`, `F2`, and `F3`.

### Elevator State

The elevator system maintains:

```txt
current cab floor
moving state
door state for each floor
```

At initialization, the cab starts on the first floor and the first-floor door is opened.

### Movement Process

When the route contains an elevator segment:

1. The agent walks to the elevator navigation point.
2. If the cab is not on the agent's floor, it moves to that floor first.
3. The agent rides the elevator to the target floor.
4. The agent is placed at the target-floor elevator navigation point.
5. The agent continues walking to the final destination.


## How to Use

1. Click a point on the building navmesh to select a destination.
2. Choose `Distance` or `Time` recommendation in the left panel.
3. Preview the distance and time routes.
4. Click `Add destination` to add another waypoint.
5. Drag waypoint handles to reorder destinations if needed.
6. Click `Start` to begin navigation.
7. Use the floor buttons to focus the camera on a specific floor.
8. Use mouse controls to rotate, zoom, and pan the scene.

## Project Structure

```txt
src/
├── App.vue
├── main.js
└── systems/
    ├── useScene.js        # Three.js scene, interaction, agent movement, route previews
    ├── pathfinder.js      # A* pathfinding and route recommendation logic
    ├── elevator.js        # Elevator construction, door state, cab animation
    └── destinations.js    # Elevator points, stair points, floor height data

public/
└── glb/
    ├── building/
    │   ├── floor1.glb
    │   ├── floor2.glb
    │   ├── floor3.glb
    │   ├── floor4.glb
    │   └── floor5.glb
    ├── building_navmesh.gltf
    └── door.glb / door2.glb / door3.glb
```

## Deploy

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in the terminal, usually:

```txt
http://localhost:5173
```

Build for production:

```bash
npm run build
```

