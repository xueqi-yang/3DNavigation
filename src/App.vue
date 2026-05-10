<template>
  <div class="app">

    <!-- Three.js canvas -->
    <canvas
      ref="canvasRef"
      class="canvas"
      @pointerdown="onCanvasPointerDown"
      @click="onCanvasClick"
    />

    <!-- Loading overlay -->
    <Transition name="fade">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-inner">
          <div class="loading-spinner" />
          <p class="loading-msg">{{ loadingMsg }}</p>
        </div>
      </div>
    </Transition>

    <!-- Left panel -->
    <div class="ui-panel left-panel">

      <!-- Route / Waypoints -->
      <div class="panel-section">
        <div class="panel-label">Route</div>

        <!-- Mode toggle -->
        <div class="mode-row">
          <button
            class="mode-btn"
            :class="{ active: !wheelchairMode }"
            @click="setMode(false)"
          >Standard</button>
          <button
            class="mode-btn"
            :class="{ active: wheelchairMode }"
            @click="setMode(true)"
          >♿ Wheelchair</button>
        </div>

        <!-- Recommendation strategy -->
        <div class="panel-label">Recommendation</div>
        <div class="mode-row">
          <button
            class="mode-btn"
            :class="{ active: routingStrategy === 'distance' }"
            @click="setStrategy('distance')"
          >Distance</button>
          <button
            class="mode-btn"
            :class="{ active: routingStrategy === 'time' }"
            @click="setStrategy('time')"
          >Time</button>
        </div>
        <div class="route-legend">
          <span><i class="legend-dot selected" />Selected route</span>
          <span><i class="legend-dot distance" />Distance route</span>
          <span><i class="legend-dot time" />Time route</span>
        </div>
        <button
          class="btn btn-secondary"
          :class="{ active: isAddingWaypoint }"
          :disabled="isNavigating || waypoints.length === 0"
          @click="onAddDestination"
        >
          {{ isAddingWaypoint ? 'Click map to add' : 'Add destination' }}
        </button>

        <!-- Waypoint list -->
        <div class="waypoint-list">
          <div v-if="waypoints.length === 0" class="empty-msg">
            No destinations added
          </div>
          <div
            v-for="(wp, i) in waypoints"
            :key="wp.id"
            class="waypoint-item"
            :class="{ dragging: draggedWaypointIndex === i }"
            @dragover.prevent
            @drop="onWaypointDrop(i)"
            @dragend="onWaypointDragEnd"
          >
            <span class="wp-num">{{ i + 1 }}</span>
            <span class="wp-name">{{ wp.name }}</span>
            <button
              class="wp-drag-handle"
              :disabled="isNavigating"
              draggable="true"
              title="Drag to reorder"
              @dragstart="onWaypointDragStart(i)"
            >
              <span />
              <span />
              <span />
            </button>
            <span class="wp-remove" @click="removeWaypoint(i)">×</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="btn-row">
          <button
            class="btn btn-primary"
            :disabled="waypoints.length === 0"
            @click="onNavigate"
          >
            {{ hasPreview ? 'Start' : 'Preview' }}
          </button>
          <button class="btn btn-secondary" @click="onClear">Clear</button>
        </div>
      </div>

      <!-- Floor selector -->
      <div class="panel-section">
        <div class="panel-label">Floor</div>
        <div class="floor-row">
          <button
            v-for="f in [1,2,3,4,5]"
            :key="f"
            class="floor-btn"
            :class="{ active: currentFloor === f }"
            @click="onFocusFloor(f)"
          >{{ f }}</button>
        </div>
      </div>

    </div>

    <!-- Elevator status (top right) -->
    <div class="elevator-panel">
      <div class="panel-label">Elevator</div>
      <div class="elev-row">
        <span class="elev-dot" :class="elevatorOpen ? 'open' : 'closed'" />
        <span>{{ elevatorOpen ? 'Door open' : 'Door closed' }}</span>
      </div>
      <div class="elev-timer">Cab at F{{ cabFloor }}</div>
      <div class="elev-hint">Right-click drag to pan</div>
    </div>

    <!-- Status bar -->
    <div class="status-bar">{{ statusMsg }}</div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useScene } from './systems/useScene.js'

const canvasRef = ref(null)

// ── Scene composable ──
const {
  isLoading, loadingMsg, currentFloor,
  elevatorOpen, cabFloor,
  statusMsg, isNavigating, hasPreview,
  init, startNavigation, showPreview,
  cancelNavigation, focusFloor,
  setWheelchairMode, setRoutingStrategy, setWaypointMarkers, clickNavigate, destroy,
} = useScene()

// ── Local UI state ──
const waypoints     = ref([])
const wheelchairMode = ref(false)
const routingStrategy = ref('distance')
const pointerDown = ref(null)
const isAddingWaypoint = ref(false)
const nextWaypointIdentity = ref(0)
const draggedWaypointIndex = ref(null)

// ── Waypoints ──
function nextWaypointLabel() {
  const code = 65 + nextWaypointIdentity.value
  nextWaypointIdentity.value += 1
  return String.fromCharCode(code)
}

function removeWaypoint(i) {
  waypoints.value.splice(i, 1)
  isAddingWaypoint.value = false
  if (waypoints.value.length > 0) {
    setWaypointMarkers(waypoints.value)
    showPreview(waypoints.value)
  } else {
    onClear()
  }
}

function reorderWaypoint(fromIndex, toIndex) {
  if (fromIndex === toIndex) return
  if (fromIndex < 0 || toIndex < 0) return
  if (fromIndex >= waypoints.value.length || toIndex >= waypoints.value.length) return
  const next = [...waypoints.value]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  waypoints.value = next
  setWaypointMarkers(waypoints.value)
  showPreview(waypoints.value)
}

function onWaypointDragStart(index) {
  if (isNavigating.value) return
  draggedWaypointIndex.value = index
}

function onWaypointDrop(index) {
  if (draggedWaypointIndex.value === null) return
  reorderWaypoint(draggedWaypointIndex.value, index)
  draggedWaypointIndex.value = null
}

function onWaypointDragEnd() {
  draggedWaypointIndex.value = null
}

// ── Mode ──
function setMode(wheelchair) {
  wheelchairMode.value = wheelchair
  setWheelchairMode(wheelchair)
}

function setStrategy(strategy) {
  routingStrategy.value = strategy
  setRoutingStrategy(strategy)
  if (waypoints.value.length > 0) showPreview(waypoints.value)
}

function onAddDestination() {
  isAddingWaypoint.value = true
}

// ── Navigation ──
function onNavigate() {
  if (!hasPreview.value) {
    showPreview(waypoints.value)
  } else {
    startNavigation(waypoints.value)
    waypoints.value = []
    isAddingWaypoint.value = false
    setWaypointMarkers(waypoints.value)
  }
}

function onClear() {
  waypoints.value     = []
  isAddingWaypoint.value = false
  nextWaypointIdentity.value = 0
  setWaypointMarkers(waypoints.value)
  cancelNavigation()
}

// ── Floor ──
function onFocusFloor(f) {
  focusFloor(f)
}

// ── Canvas click ──
function onCanvasPointerDown(e) {
  pointerDown.value = {
    x: e.clientX,
    y: e.clientY,
    button: e.button,
  }
}

function onCanvasClick(e) {
  if (!pointerDown.value || pointerDown.value.button !== 0) return
  const dx = e.clientX - pointerDown.value.x
  const dy = e.clientY - pointerDown.value.y
  const dragDistance = Math.sqrt(dx * dx + dy * dy)
  pointerDown.value = null
  if (dragDistance > 4) return

  const clicked = clickNavigate(e, canvasRef.value)
  if (!clicked) {
    if (isAddingWaypoint.value) {
      isAddingWaypoint.value = false
      return
    }
    onClear()
    return
  }
  if (isAddingWaypoint.value) {
    const label = nextWaypointLabel()
    waypoints.value.push({
      ...clicked,
      id: `${clicked.id}_${label}`,
      label,
      name: `Point ${label}`,
    })
    isAddingWaypoint.value = false
  } else {
    nextWaypointIdentity.value = 0
    const label = nextWaypointLabel()
    waypoints.value = [{
      ...clicked,
      id: `${clicked.id}_${label}`,
      label,
      name: `Point ${label}`,
    }]
  }
  setWaypointMarkers(waypoints.value)
  showPreview(waypoints.value)
}

// ── Lifecycle ──
onMounted(() => init(canvasRef.value))
onUnmounted(() => destroy())
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: #0a0a0f;
  font-family: 'DM Mono', monospace;
  overflow: hidden;
  height: 100vh;
}

@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');

.app { width: 100vw; height: 100vh; position: relative; }

.canvas {
  width: 100%;
  height: 100%;
  display: block;
  position: absolute;
  top: 0; left: 0;
  z-index: 0;
}

/* ── Loading ── */
.loading-overlay {
  position: absolute; inset: 0;
  background: #0a0a0f;
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.loading-inner { text-align: center; }
.loading-spinner {
  width: 32px; height: 32px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: rgba(99,179,237,0.7);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-msg { font-size: 12px; color: rgba(255,255,255,0.4); letter-spacing: 0.1em; }

/* ── Panels ── */
.ui-panel {
  position: absolute;
  background: rgba(10,10,20,0.88);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 18px;
  backdrop-filter: blur(16px);
  color: #e8e6e0;
  z-index: 10;
}
.left-panel {
  top: 24px; left: 24px;
  width: 290px;
  max-height: calc(100% - 48px);
  overflow-y: auto;
  display: flex; flex-direction: column; gap: 20px;
}
.panel-section { display: flex; flex-direction: column; gap: 10px; }
.panel-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

/* ── Search ── */
.search-input {
  width: 100%;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 9px 12px;
  color: #e8e6e0;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}
.search-input:focus { border-color: rgba(99,179,237,0.5); }
.search-input::placeholder { color: rgba(255,255,255,0.2); }

.search-results {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 180px; overflow-y: auto;
}
.result-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  border: 1px solid transparent;
  transition: all 0.15s;
}
.result-item:hover {
  background: rgba(99,179,237,0.1);
  border-color: rgba(99,179,237,0.3);
}
.floor-badge {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.05);
  padding: 2px 6px; border-radius: 4px;
}

/* ── Mode toggle ── */
.mode-row { display: flex; gap: 6px; }
.mode-btn {
  flex: 1; padding: 7px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: rgba(255,255,255,0.3);
  font-family: 'DM Mono', monospace;
  font-size: 10px; cursor: pointer;
  transition: all 0.2s; letter-spacing: 0.04em;
}
.mode-btn.active {
  background: rgba(99,179,237,0.12);
  border-color: rgba(99,179,237,0.4);
  color: rgba(99,179,237,0.9);
}
.route-legend {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 10px;
  color: rgba(255,255,255,0.45);
}
.route-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.legend-dot.selected { background: #ffffff; }
.legend-dot.distance { background: #ffd700; }
.legend-dot.time { background: #68d391; }

/* ── Waypoints ── */
.waypoint-list { display: flex; flex-direction: column; gap: 5px; min-height: 24px; }
.empty-msg { font-size: 11px; color: rgba(255,255,255,0.2); text-align: center; padding: 6px 0; }
.waypoint-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 6px; font-size: 12px;
  border: 1px solid transparent;
}
.waypoint-item.dragging {
  opacity: 0.45;
  border-color: rgba(255,215,0,0.45);
}
.wp-num { color: rgba(99,179,237,0.6); font-size: 10px; min-width: 14px; }
.wp-name { flex: 1; }
.wp-drag-handle {
  width: 22px;
  height: 22px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  background: rgba(255,255,255,0.04);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  padding: 0 5px;
  cursor: grab;
}
.wp-drag-handle span {
  display: block;
  height: 1px;
  background: rgba(255,255,255,0.45);
}
.wp-drag-handle:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}
.wp-drag-handle:not(:disabled):hover {
  border-color: rgba(99,179,237,0.35);
}
.wp-drag-handle:not(:disabled):hover span {
  background: #90cdf4;
}
.wp-remove {
  cursor: pointer; color: rgba(255,255,255,0.2);
  font-size: 16px; line-height: 1; transition: color 0.15s;
}
.wp-remove:hover { color: rgba(255,100,100,0.7); }

/* ── Buttons ── */
.btn-row { display: flex; gap: 8px; }
.btn {
  flex: 1; padding: 9px;
  border-radius: 8px; border: none;
  font-family: 'DM Mono', monospace;
  font-size: 11px; cursor: pointer;
  transition: all 0.2s; letter-spacing: 0.04em;
}
.btn:disabled { opacity: 0.3; cursor: not-allowed; }
.btn-primary {
  background: rgba(99,179,237,0.15);
  color: rgba(99,179,237,0.9);
  border: 1px solid rgba(99,179,237,0.3);
}
.btn-primary:not(:disabled):hover { background: rgba(99,179,237,0.25); }
.btn-secondary {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.08);
}
.btn-secondary:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }
.btn-secondary.active {
  background: rgba(255,215,0,0.15);
  border-color: rgba(255,215,0,0.4);
  color: #ffd700;
}

/* ── Floor selector ── */
.floor-row { display: flex; gap: 6px; }
.floor-btn {
  flex: 1; padding: 8px 4px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  color: rgba(255,255,255,0.3);
  font-family: 'DM Mono', monospace;
  font-size: 11px; cursor: pointer;
  transition: all 0.2s;
}
.floor-btn.active {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.8);
  border-color: rgba(255,255,255,0.2);
}

/* ── Elevator panel ── */
.elevator-panel {
  position: absolute; top: 24px; right: 24px;
  background: rgba(10,10,20,0.88);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 16px 20px;
  backdrop-filter: blur(16px);
  color: #e8e6e0; z-index: 10;
  min-width: 150px;
  display: flex; flex-direction: column; gap: 8px;
}
.elev-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.elev-dot {
  width: 8px; height: 8px; border-radius: 50%;
  transition: background 0.4s;
}
.elev-dot.open  { background: #68d391; box-shadow: 0 0 6px #68d391; }
.elev-dot.closed { background: #fc8181; box-shadow: 0 0 6px #fc8181; }
.elev-timer { font-size: 10px; color: rgba(255,255,255,0.25); }
.elev-hint  { font-size: 9px;  color: rgba(255,255,255,0.15); margin-top: 2px; }

/* ── Status bar ── */
.status-bar {
  position: absolute; bottom: 24px; left: 50%;
  transform: translateX(-50%);
  background: rgba(10,10,20,0.9);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 10px 20px;
  font-size: 12px; color: rgba(255,255,255,0.5);
  backdrop-filter: blur(12px);
  pointer-events: none; white-space: nowrap; z-index: 10;
}

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
</style>
