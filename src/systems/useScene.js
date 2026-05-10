import { ref, shallowRef } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { PathfinderSystem } from '../systems/pathfinder.js'
import { ElevatorSystem } from '../systems/elevator.js'
import { ELEVATOR_NAV_POSITIONS, ELEVATOR_POSITIONS, getFloorFromY, FLOOR_Y } from '../systems/destinations.js'

const AGENT_SPEED  = 1.5
const AGENT_HEIGHT = 0.5
const AGENT_RADIUS = 0.12
const AGENT_HEADING_OFFSET = -Math.PI / 2
const ASSET_BASE = import.meta.env.BASE_URL
const ROUTE_COLORS = {
  selected: 0xffffff,
  distance: 0xffd700,
  time: 0x68d391,
}

export function useScene() {
  // ── Reactive state (exposed to Vue components) ──
  const isLoading      = ref(true)
  const loadingMsg     = ref('Loading building...')
  const currentFloor   = ref(1)
  const elevatorOpen   = ref(false)
  const cabFloor        = ref(1)
  const statusMsg      = ref('Select a destination to navigate')
  const isNavigating   = ref(false)
  const hasPreview     = ref(false)

  // ── Non-reactive Three.js objects (shallowRef to avoid deep proxy) ──
  const scene      = shallowRef(null)
  const camera     = shallowRef(null)
  const renderer   = shallowRef(null)
  const controls   = shallowRef(null)

  let pathfinder    = null
  let elevator      = null
  let agentGroup    = null
  let pathLine      = null
  let distancePreviewLine = null
  let timePreviewLine = null
  let waypointMarkers = []
  let floorMeshes   = {}
  let currentPath   = []
  let finalDest     = null
  let waypointQueue = []
  let animFrameId   = null
  let clock         = null


  // ─────────────────────────────────────────
  //  INIT — call this with the canvas element
  // ─────────────────────────────────────────
  async function init(canvas) {
    // Scene
    const _scene = new THREE.Scene()
    _scene.background = new THREE.Color(0x2a2d3a)
    _scene.fog = new THREE.Fog(0x2a2d3a, 40, 120)
    scene.value = _scene

    // Camera
    const _camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200)
    _camera.position.set(0, 12, 14)
    camera.value = _camera

    // Renderer
    const _renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    _renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    _renderer.shadowMap.enabled = true
    renderer.value = _renderer

    // Lights — brighter so floors are clearly visible
    _scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(-10, 20, 10)
    sun.castShadow = true
    _scene.add(sun)
    const fill = new THREE.DirectionalLight(0xaaccff, 0.8)
    fill.position.set(10, 5, -10)
    _scene.add(fill)
    const bottom = new THREE.DirectionalLight(0xffffff, 0.4)
    bottom.position.set(0, -10, 0)
    _scene.add(bottom)

    // Controls
    const _controls = new OrbitControls(_camera, canvas)
    _controls.enableDamping  = true
    _controls.dampingFactor  = 0.08
    _controls.minDistance    = 3
    _controls.maxDistance    = 120
    _controls.enablePan      = true
    _controls.panSpeed       = 1.2
    _controls.screenSpacePanning = true
    _controls.target.set(0.23, 4.3, -1.53)
    _controls.update()
    controls.value = _controls

    // Pathfinder
    pathfinder = new PathfinderSystem()

    // Agent
    _buildAgent(_scene)

    // Path lines
    _buildPathLines(_scene)

    // Load models
    await _loadModels(_scene)

    // Elevator system
    elevator = new ElevatorSystem(_scene)
    _buildElevatorPositionMarkers(_scene)
    elevatorOpen.value = true  // F1 door opens on init (cab starts at F1)
    cabFloor.value = 1
    pathfinder.setCabFloorGetter(() => elevator._cabFloor)
    elevator.onChange((floor, isOpen) => {
      // Update UI: reflect door state for whichever floor cab is on
      cabFloor.value = elevator._cabFloor
      const agentFloor = getFloorFromY(agentGroup.position.y)
      if (floor === elevator._cabFloor || floor === agentFloor) {
        elevatorOpen.value = isOpen
      }
      // D* Lite replan if navigating and affected floor is relevant
      if (isNavigating.value && finalDest && floor === agentFloor) {
        const newPath = pathfinder.replan(
          agentGroup.position.clone(), finalDest, isOpen
        )
        if (newPath) {
          currentPath = newPath
          _updatePathLine()
          statusMsg.value = isOpen
            ? `Elevator F${floor} opened — rerouting via elevator`
            : `Elevator F${floor} closed — rerouting via stairs`
        }
      }
    })

    // Render loop
    clock = new THREE.Timer()
    _animate()

    // Resize
    window.addEventListener('resize', () => _onResize(canvas))

    isLoading.value = false
    statusMsg.value = 'Select a destination to navigate'
  }

  // ── Build agent mesh ──
  function _buildAgent(s) {
    agentGroup = new THREE.Group()

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(AGENT_RADIUS, AGENT_RADIUS, AGENT_HEIGHT, 16),
      new THREE.MeshPhongMaterial({ color: 0x63b3ed })
    )
    body.position.y = AGENT_HEIGHT / 2

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(AGENT_RADIUS * 1.4, 12, 12),
      new THREE.MeshPhongMaterial({ color: 0x90cdf4 })
    )
    head.position.y = AGENT_HEIGHT + AGENT_RADIUS * 1.4

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.12, 8),
      new THREE.MeshPhongMaterial({ color: 0xffd700 })
    )
    cone.rotation.z = -Math.PI / 2
    cone.position.set(AGENT_RADIUS + 0.06, AGENT_HEIGHT / 2, 0)

    agentGroup.add(body, head, cone)
    agentGroup.position.set(0, 0.3, -1)
    s.add(agentGroup)
  }

  // ── Build path + preview lines ──
  function _buildPathLines(s) {
    pathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x63b3ed, opacity: 0.7, transparent: true })
    )
    distancePreviewLine = _makePreviewLine(0xffd700)
    timePreviewLine = _makePreviewLine(0x68d391)
    s.add(pathLine)
    s.add(distancePreviewLine)
    s.add(timePreviewLine)
  }

  function _makePreviewLine(color) {
    const geometry = new LineGeometry()
    geometry.setPositions([0, 0, 0, 0, 0, 0])
    const material = new LineMaterial({
      color,
      linewidth: 5,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    })
    material.resolution.set(window.innerWidth, window.innerHeight)
    const line = new Line2(geometry, material)
    line.computeLineDistances()
    line.renderOrder = 20
    line.visible = false
    return line
  }

  // ── Visual debug markers for configured elevator navigation points ──
  function _buildElevatorPositionMarkers(s) {
    const elevatorMat = new THREE.MeshPhongMaterial({
      color: 0xff4d4d,
      emissive: 0xff1f1f,
      emissiveIntensity: 0.45,
    })
    const navMat = new THREE.MeshPhongMaterial({
      color: 0x4dff88,
      emissive: 0x20c060,
      emissiveIntensity: 0.45,
    })

    for (const [floorStr, pos] of Object.entries(ELEVATOR_POSITIONS)) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 16, 16),
        elevatorMat.clone()
      )
      marker.position.set(pos.x, pos.y + 0.16, pos.z)
      marker.name = `ElevatorPositionMarker_F${floorStr}`
      s.add(marker)
    }

    for (const [floorStr, pos] of Object.entries(ELEVATOR_NAV_POSITIONS)) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        navMat.clone()
      )
      marker.position.set(pos.x, pos.y + 0.3, pos.z)
      marker.name = `ElevatorNavPositionMarker_F${floorStr}`
      s.add(marker)
    }
  }

  function _makeWaypointMarker(order, waypoint) {
    const group = new THREE.Group()
    const position = waypoint.position
    group.position.set(position.x, position.y + 0.55, position.z)

    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xffd700,
        emissiveIntensity: 0.35,
      })
    )

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 10),
      new THREE.MeshPhongMaterial({ color: 0xffd700 })
    )
    stem.position.y = -0.28

    const label = _makeWaypointLabel(`${order}${waypoint.label || ''}`)
    label.position.y = 0.28

    group.add(stem, pin, label)
    group.name = `WaypointMarker_${order}${waypoint.label || ''}`
    return group
  }

  function _makeWaypointLabel(text) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(32, 32, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#111827'
    ctx.font = text.length > 2 ? 'bold 22px monospace' : 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(text), 32, 34)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }))
    sprite.scale.set(0.42, 0.42, 1)
    return sprite
  }

  // ── Load all GLB models ──
  async function _loadModels(s) {
    const loader = new GLTFLoader()
    const assetUrl = path => `${ASSET_BASE}${path.replace(/^\//, '')}`
    const load = path => new Promise((res, rej) => loader.load(assetUrl(path), g => res(g.scene), undefined, rej))

    try {
      loadingMsg.value = 'Loading floors...'
      for (let i = 1; i <= 5; i++) {
        const floorScene = await load(`/glb/building/floor${i}.glb`)
        const mesh = floorScene.getObjectByName(`Floor${i}`) || floorScene.children[0]
        if (mesh) {
          // Clone and brighten material so floors are visible
          mesh.material = mesh.material.clone()
          mesh.material.transparent = true
          mesh.material.color = new THREE.Color(0xccccdd)
          mesh.receiveShadow = true
          // The floor model files are ordered top-to-bottom, while the UI and
          // navigation logic use bottom-to-top floor numbers.
          floorMeshes[6 - i] = mesh
          s.add(mesh)
        }
      }

      loadingMsg.value = 'Loading doors...'
      for (const url of ['/glb/door.glb', '/glb/door2.glb', '/glb/door3.glb']) {
        const d = await load(url)
        s.add(d)
      }

      loadingMsg.value = 'Loading navmesh...'
      const navScene = await load('/glb/building_navmesh.gltf')
      pathfinder.setNavmesh(navScene)

      _updateFloorOpacity(1)

    } catch (err) {
      console.error('[Scene] Load error:', err)
      loadingMsg.value = 'Error loading models — check /public/glb/'
    }
  }

  // ── Render loop ──
  function _animate() {
    animFrameId = requestAnimationFrame(_animate)
    clock.update()
    const delta = clock.getDelta()
    _moveAgent(delta)
    controls.value?.update()
    renderer.value?.render(scene.value, camera.value)
  }

  // ── Agent movement ──
  let _elevatorWaiting = false   // true while waiting for cab to arrive at agent floor
  let _elevatorRiding  = false   // true while cab is moving to target floor
  let _elevatorLandPos = null    // {x,y,z} where agent lands after ride
  let _logTimer        = 0       // throttle position logging

  function _moveAgent(delta) {
    if (!isNavigating.value || currentPath.length === 0) return

    // Throttled position log every 0.5s
    _logTimer += delta
    if (_logTimer >= 0.5) {
      _logTimer = 0
      const p = agentGroup.position
      const seg = currentPath[0]?._elevatorRide ? 'elevator ride' : 'walking'
      console.log(`[Agent] pos=(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})  F${getFloorFromY(p.y)}  segment=${seg}  remaining points=${currentPath.length}`)
    }

    const target = currentPath[0]

    // ── Case 1: Elevator ──
    if (target._elevatorRide && !_elevatorWaiting && !_elevatorRiding) {
      const toFloor   = target._toFloor
      const fromFloor = getFloorFromY(agentGroup.position.y)
      _elevatorLandPos = { x: target._landX, y: target._landY, z: target._landZ }

      // Snap agent XZ to elevator entry, clear path line
      agentGroup.position.x = target.x
      agentGroup.position.z = target.z
      pathLine.geometry.dispose()
      pathLine.geometry = new THREE.BufferGeometry()
      currentPath.shift()

      if (elevator._cabFloor !== fromFloor) {
        // ── Phase A: Summon cab to agent's floor first ──
        _elevatorWaiting = true
        console.log(`[Elevator] Waiting for cab from F${elevator._cabFloor} to F${fromFloor}`)
        statusMsg.value = `Waiting for elevator...`
        elevator.moveCabToFloor(fromFloor).then(() => {
          // Cab arrived at agent floor — now ride to target floor
          _elevatorWaiting = false
          _elevatorRiding  = true
          console.log(`[Elevator] Cab arrived at F${fromFloor}; boarding and riding to F${toFloor}`)
          statusMsg.value = `Taking elevator to F${toFloor}...`
          elevator.moveCabToFloor(toFloor).then(() => {
            agentGroup.position.set(_elevatorLandPos.x, _elevatorLandPos.y, _elevatorLandPos.z)
            console.log(`[Elevator] Arrived at F${toFloor}`)
            _elevatorRiding  = false
            _elevatorLandPos = null
            currentFloor.value = toFloor
            _updateFloorOpacity(toFloor)
            _updatePathLine()
          })
        })
      } else {
        // ── Cab already on agent's floor — ride directly ──
        _elevatorRiding = true
        console.log(`[Elevator] Direct ride from F${fromFloor} to F${toFloor}`)
        statusMsg.value = `Taking elevator to F${toFloor}...`
        elevator.moveCabToFloor(toFloor).then(() => {
          agentGroup.position.set(_elevatorLandPos.x, _elevatorLandPos.y, _elevatorLandPos.z)
          console.log(`[Elevator] Arrived at F${toFloor}`)
          _elevatorRiding  = false
          _elevatorLandPos = null
          currentFloor.value = toFloor
          _updateFloorOpacity(toFloor)
          _updatePathLine()
        })
      }
      return
    }

    // While waiting for cab or riding, freeze agent (cab animation plays independently)
    if (_elevatorWaiting || _elevatorRiding) {
      if (_elevatorRiding && elevator?._cab) {
        agentGroup.position.y = elevator._cab.position.y - 0.55 + 0.3
      }
      return
    }

    // ── Case 2: Normal movement — full 3D (navmesh A* path Y values are exact) ──
    const dx   = target.x - agentGroup.position.x
    const dy   = target.y - agentGroup.position.y
    const dz   = target.z - agentGroup.position.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist > 0.04) {
      const speed = delta * AGENT_SPEED
      const scale = Math.min(speed / dist, 1)
      agentGroup.position.x += dx * scale
      agentGroup.position.y += dy * scale
      agentGroup.position.z += dz * scale
      agentGroup.rotation.y  = Math.atan2(dx, dz) + AGENT_HEADING_OFFSET
      // Update active floor as Y changes (e.g. on stairs)
      const f = getFloorFromY(agentGroup.position.y)
      if (f !== currentFloor.value) {
        currentFloor.value = f
        _updateFloorOpacity(f)
      }
      _updatePathLine()
    } else {
      agentGroup.position.set(target.x, target.y, target.z)
      currentPath.shift()
      if (currentPath.length === 0) _onArrived()
    }
  }

  function _onArrived() {
    waypointQueue.shift()
    if (waypointQueue.length > 0) {
      _navigateToNext()
    } else {
      isNavigating.value = false
      statusMsg.value    = 'Arrived at destination'
      _updatePathLine()
    }
  }

  // ── Navigate to next waypoint in queue ──
  function _navigateToNext() {
    if (waypointQueue.length === 0) return
    const dest = waypointQueue[0]
    finalDest  = dest.position

    // Check elevator open state for the current floor
    const fromFloor = getFloorFromY(agentGroup.position.y)
    const elevOpen  = elevator ? elevator.isFloorOpen(fromFloor) : true

    const path = pathfinder.findPath(
      agentGroup.position.clone(), dest.position, elevOpen
    )
    if (!path) {
      statusMsg.value = 'No accessible route found'
      return
    }

    currentPath        = pathfinder.stringPull(path)
    isNavigating.value = true
    hasPreview.value   = false
    clearPreviewLine()
    statusMsg.value = `Navigating to ${dest.name}...`
    _updateFloorOpacity(fromFloor)
    _updatePathLine()
  }

  // ── Path line updates ──
  function _updatePathLine() {
    pathLine.geometry.dispose()
    if (currentPath.length === 0) {
      pathLine.geometry = new THREE.BufferGeometry()
      return
    }
    const pts = [
      agentGroup.position.clone().add(new THREE.Vector3(0, 0.1, 0)),
      ...currentPath.map(p => new THREE.Vector3(p.x, p.y + 0.1, p.z)),
    ]
    pathLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
  }

  function clearPreviewLine() {
    distancePreviewLine.geometry.dispose()
    distancePreviewLine.geometry = new LineGeometry()
    distancePreviewLine.geometry.setPositions([0, 0, 0, 0, 0, 0])
    distancePreviewLine.visible = false
    timePreviewLine.geometry.dispose()
    timePreviewLine.geometry = new LineGeometry()
    timePreviewLine.geometry.setPositions([0, 0, 0, 0, 0, 0])
    timePreviewLine.visible = false
    hasPreview.value = false
  }

  // ── Floor opacity ──
  function _updateFloorOpacity(active) {
    for (const [f, mesh] of Object.entries(floorMeshes)) {
      mesh.material.opacity = parseInt(f) === active ? 0.9 : 0.45
    }
    currentFloor.value = active
  }


  // ── Resize ──
  function _onResize(canvas) {
    const w = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth
    const h = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
    renderer.value.setSize(w, h, false)
    distancePreviewLine?.material?.resolution.set(w, h)
    timePreviewLine?.material?.resolution.set(w, h)
  }

  // ═══════════════════════════════════════════
  //  PUBLIC API (called from Vue components)
  // ═══════════════════════════════════════════

  function startNavigation(waypoints) {
    waypointQueue = [...waypoints]
    _navigateToNext()
  }

  function showPreview(waypoints) {
    if (!pathfinder.ready || waypoints.length === 0) return
    const start = agentGroup.position.clone()
    console.log(
      `[Preview] start=(${start.x.toFixed(3)}, ${start.y.toFixed(3)}, ${start.z.toFixed(3)}) ` +
      `F${getFloorFromY(start.y)}  waypoint count=${waypoints.length}`
    )
    waypoints.forEach((wp, i) => {
      console.log(
        `[Preview] waypoint ${i + 1} ${wp.name || wp.id || 'destination'}=` +
        `(${wp.position.x.toFixed(3)}, ${wp.position.y.toFixed(3)}, ${wp.position.z.toFixed(3)}) ` +
        `F${getFloorFromY(wp.position.y)}`
      )
    })

    const distancePath = _previewPathForStrategy(waypoints, 'distance')
    const timePath = _previewPathForStrategy(waypoints, 'time')

    _updatePreviewLineColors()
    _setPreviewLine(distancePreviewLine, distancePath, 0.08, start)
    _setPreviewLine(timePreviewLine, timePath, 0.14, start)

    hasPreview.value = Boolean(distancePath.length || timePath.length)
    if (hasPreview.value) {
      statusMsg.value = 'Choose Distance or Time, then start navigation'
    }
  }

  function _previewPathForStrategy(waypoints, strategy) {
    let from = agentGroup.position.clone()
    let fullPath = []
    const fromFloor = getFloorFromY(agentGroup.position.y)
    const elevOpen  = elevator ? elevator.isFloorOpen(fromFloor) : true
    for (const [index, wp] of waypoints.entries()) {
      console.log(
        `[Preview:${strategy}] leg ${index + 1} from=(${from.x.toFixed(3)}, ${from.y.toFixed(3)}, ${from.z.toFixed(3)}) ` +
        `F${getFloorFromY(from.y)} -> to=(${wp.position.x.toFixed(3)}, ${wp.position.y.toFixed(3)}, ${wp.position.z.toFixed(3)}) ` +
        `F${getFloorFromY(wp.position.y)}`
      )
      const path = pathfinder.findPath(from, wp.position, elevOpen, strategy)
      if (path) {
        console.log(
          `[Preview:${strategy}] leg ${index + 1} path points=${path.length} ` +
          `first=${_formatPoint(path[0])}  last=${_formatPoint(path[path.length - 1])}`
        )
        fullPath = fullPath.concat(path)
      } else {
        console.warn(`[Preview:${strategy}] leg ${index + 1} has no path`)
      }
      from = wp.position
    }
    console.log(`[Preview:${strategy}] total path points=${fullPath.length}`)
    return fullPath
  }

  function _setPreviewLine(line, path, yOffset, start = null) {
    line.geometry.dispose()
    if (!path.length) {
      line.geometry = new LineGeometry()
      line.geometry.setPositions([0, 0, 0, 0, 0, 0])
      line.visible = false
      return
    }
    const points = [
      ...(start ? [new THREE.Vector3(start.x, start.y + yOffset, start.z)] : []),
      ...path.map(p => new THREE.Vector3(p.x, p.y + yOffset, p.z)),
    ]
    const positions = points.flatMap(p => [p.x, p.y, p.z])
    line.geometry = new LineGeometry()
    line.geometry.setPositions(positions)
    line.computeLineDistances()
    line.visible = true
  }

  function _formatPoint(point) {
    if (!point) return 'null'
    return `(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`
  }

  function cancelNavigation() {
    isNavigating.value = false
    waypointQueue      = []
    currentPath        = []
    finalDest          = null
    clearPreviewLine()
    pathLine.geometry.setFromPoints([])
    statusMsg.value = 'Navigation cancelled'
  }

  function focusFloor(floor) {
    _updateFloorOpacity(floor)
    const targetY = FLOOR_Y[floor] + 1
    controls.value.target.set(0, targetY, -3)
    camera.value.position.set(0, targetY + 8, targetY + 10)
    controls.value.update()
  }

  function setWheelchairMode(enabled) {
    pathfinder.setWheelchairMode(enabled)
  }

  function setRoutingStrategy(strategy) {
    pathfinder.setRoutingStrategy(strategy)
    _updatePreviewLineColors()
  }

  function setWaypointMarkers(waypoints) {
    for (const marker of waypointMarkers) {
      scene.value?.remove(marker)
      marker.traverse(child => {
        child.geometry?.dispose?.()
        child.material?.map?.dispose?.()
        child.material?.dispose?.()
      })
    }
    waypointMarkers = []
    if (!scene.value) return

    waypointMarkers = waypoints.map((wp, index) => _makeWaypointMarker(index + 1, wp))
    waypointMarkers.forEach(marker => scene.value.add(marker))
  }

  function _updatePreviewLineColors() {
    if (!pathfinder) return
    distancePreviewLine?.material?.color.setHex(
      pathfinder.routingStrategy === 'distance' ? ROUTE_COLORS.selected : ROUTE_COLORS.distance
    )
    timePreviewLine?.material?.color.setHex(
      pathfinder.routingStrategy === 'time' ? ROUTE_COLORS.selected : ROUTE_COLORS.time
    )
  }

  function clickNavigate(event, canvas) {
    const rect  = canvas.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width)  * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    const ray = new THREE.Raycaster()
    ray.setFromCamera(mouse, camera.value)

    // ── Step 1: raycast against navmesh only ──
    // This guarantees the target is on a walkable surface (flat floor or stair ramp).
    let pt = null
    const navmeshMesh = pathfinder.getNavmesh()
    if (navmeshMesh) {
      navmeshMesh.updateMatrixWorld(true)
      const navHits = ray.intersectObject(navmeshMesh, true)
      if (navHits.length > 0) {
        pt = navHits[0].point.clone()
        console.log(`[Click] Navmesh hit (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)})`)
        console.log(
          `[Click] start=(${agentGroup.position.x.toFixed(3)}, ${agentGroup.position.y.toFixed(3)}, ${agentGroup.position.z.toFixed(3)}) ` +
          `F${getFloorFromY(agentGroup.position.y)}  ` +
          `target=(${pt.x.toFixed(3)}, ${pt.y.toFixed(3)}, ${pt.z.toFixed(3)}) F${getFloorFromY(pt.y)}`
        )
      }
    }

    // ── Step 2: fallback — hit any building mesh, snap to nearest navmesh node ──
    if (!pt) {
      const allHits = ray.intersectObjects(scene.value.children, true)
      if (allHits.length === 0) {
        console.warn('[Click] No scene object hit')
        return
      }
      const rawPt   = allHits[0].point.clone()
      const snapped = pathfinder.snapToNavmesh(rawPt)
      if (!snapped) {
        console.warn(`[Click] Could not snap to navmesh  raw=(${rawPt.x.toFixed(2)},${rawPt.y.toFixed(2)},${rawPt.z.toFixed(2)})`)
        return
      }
      pt = new THREE.Vector3(snapped.x, snapped.y, snapped.z)
      console.log(`[Click] Snapped to navmesh (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)})`)
      console.log(
        `[Click] start=(${agentGroup.position.x.toFixed(3)}, ${agentGroup.position.y.toFixed(3)}, ${agentGroup.position.z.toFixed(3)}) ` +
        `F${getFloorFromY(agentGroup.position.y)}  ` +
        `raw=(${rawPt.x.toFixed(3)}, ${rawPt.y.toFixed(3)}, ${rawPt.z.toFixed(3)})  ` +
        `snapped=(${pt.x.toFixed(3)}, ${pt.y.toFixed(3)}, ${pt.z.toFixed(3)}) F${getFloorFromY(pt.y)}`
      )
    }

    statusMsg.value = 'Destination selected'
    return {
      id: `clicked_${Date.now()}`,
      name: 'Clicked point',
      floor: getFloorFromY(pt.y),
      position: pt,
      accessible: true,
      category: 'custom',
    }
  }

  function destroy() {
    cancelAnimationFrame(animFrameId)
    elevator?.destroy()
    renderer.value?.dispose()
    window.removeEventListener('resize', _onResize)
  }

  return {
    // State
    isLoading, loadingMsg, currentFloor,
    elevatorOpen, cabFloor,
    statusMsg, isNavigating, hasPreview,
    // Methods
    init, startNavigation, showPreview,
    cancelNavigation, focusFloor,
    setWheelchairMode, setRoutingStrategy, setWaypointMarkers, clickNavigate, destroy,
  }
}
