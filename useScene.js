import { ref, shallowRef } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PathfinderSystem } from '../systems/pathfinder.js'
import { ElevatorSystem } from '../systems/elevator.js'
import { getFloorFromY, FLOOR_Y } from '../systems/destinations.js'

const AGENT_SPEED  = 3.5
const AGENT_HEIGHT = 0.5
const AGENT_RADIUS = 0.12

export function useScene() {
  // ── Reactive state (exposed to Vue components) ──
  const isLoading      = ref(true)
  const loadingMsg     = ref('Loading building...')
  const currentFloor   = ref(1)
  const elevatorOpen   = ref(true)
  const elevatorTimer  = ref(8)
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
  let previewLine   = null
  let floorMeshes   = {}
  let currentPath   = []
  let finalDest     = null
  let waypointQueue = []
  let animFrameId   = null
  let clock         = null
  let countdownInt  = null

  // ─────────────────────────────────────────
  //  INIT — call this with the canvas element
  // ─────────────────────────────────────────
  async function init(canvas) {
    // Scene
    const _scene = new THREE.Scene()
    _scene.background = new THREE.Color(0x0a0a0f)
    _scene.fog = new THREE.Fog(0x0a0a0f, 40, 100)
    scene.value = _scene

    // Camera
    const _camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200)
    _camera.position.set(0, 12, 14)
    camera.value = _camera

    // Renderer
    const _renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    _renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    _renderer.shadowMap.enabled = true
    renderer.value = _renderer

    // Lights
    _scene.add(new THREE.AmbientLight(0x8899bb, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 0.8)
    sun.position.set(-10, 20, 10)
    sun.castShadow = true
    _scene.add(sun)
    const fill = new THREE.DirectionalLight(0x6699ff, 0.3)
    fill.position.set(10, 5, -10)
    _scene.add(fill)

    // Controls
    const _controls = new OrbitControls(_camera, canvas)
    _controls.enableDamping  = true
    _controls.dampingFactor  = 0.08
    _controls.minDistance    = 3
    _controls.maxDistance    = 60
    _controls.maxPolarAngle  = Math.PI / 2
    _controls.screenSpacePanning = true
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
    elevatorOpen.value = true
    elevator.onChange((open) => {
      elevatorOpen.value = open
      _startElevatorCountdown()
      // D* Lite replan if navigating
      if (isNavigating.value && finalDest) {
        const newPath = pathfinder.replan(
          agentGroup.position.clone(), finalDest, open
        )
        if (newPath) {
          currentPath = newPath
          _updatePathLine()
          statusMsg.value = open
            ? 'Elevator opened — rerouting via elevator'
            : 'Elevator closed — rerouting via stairs'
        }
      }
    })
    _startElevatorCountdown()

    // Render loop
    clock = new THREE.Clock()
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
    agentGroup.position.set(0, 0.05, -1)
    s.add(agentGroup)
  }

  // ── Build path + preview lines ──
  function _buildPathLines(s) {
    pathLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x63b3ed, opacity: 0.7, transparent: true })
    )
    previewLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffd700, opacity: 0.5, transparent: true })
    )
    s.add(pathLine)
    s.add(previewLine)
  }

  // ── Load all GLB models ──
  async function _loadModels(s) {
    const loader = new GLTFLoader()
    const load   = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej))

    try {
      loadingMsg.value = 'Loading floors...'
      for (let i = 1; i <= 5; i++) {
        const floorScene = await load(`/glb/building/floor${i}.glb`)
        const mesh = floorScene.getObjectByName(`Floor${i}`) || floorScene.children[0]
        if (mesh) {
          mesh.material = mesh.material.clone()
          mesh.material.transparent = true
          mesh.receiveShadow = true
          floorMeshes[i] = mesh
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
    const delta = clock.getDelta()
    _moveAgent(delta)
    controls.value?.update()
    renderer.value?.render(scene.value, camera.value)
  }

  // ── Agent movement ──
  function _moveAgent(delta) {
    if (!isNavigating.value || currentPath.length === 0) return

    const target = currentPath[0]

    // Elevator / stair transition — teleport
    if (target._elevatorRide || target._stairTransition) {
      agentGroup.position.set(target.x, target.y, target.z)
      currentPath.shift()
      currentFloor.value = getFloorFromY(agentGroup.position.y)
      _updateFloorOpacity(currentFloor.value)
      _updatePathLine()
      return
    }

    const targetVec = new THREE.Vector3(target.x, target.y, target.z)
    const dist      = targetVec.clone().sub(agentGroup.position)

    if (dist.lengthSq() > 0.05 * 0.05) {
      const step = dist.normalize().multiplyScalar(delta * AGENT_SPEED)
      agentGroup.position.add(step)
      agentGroup.rotation.y = Math.atan2(dist.x, dist.z)
      _updatePathLine()
    } else {
      currentPath.shift()
      if (currentPath.length === 0) {
        _onArrived()
      }
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

    const path = pathfinder.findPath(
      agentGroup.position.clone(), dest.position, elevatorOpen.value
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
    _updateFloorOpacity(getFloorFromY(agentGroup.position.y))
    _updatePathLine()
  }

  // ── Path line updates ──
  function _updatePathLine() {
    if (currentPath.length === 0) {
      pathLine.geometry.setFromPoints([])
      return
    }
    const pts = [
      agentGroup.position.clone().add(new THREE.Vector3(0, 0.1, 0)),
      ...currentPath.map(p => new THREE.Vector3(p.x, p.y + 0.1, p.z)),
    ]
    pathLine.geometry.setFromPoints(pts)
  }

  function clearPreviewLine() {
    previewLine.geometry.setFromPoints([])
    hasPreview.value = false
  }

  // ── Floor opacity ──
  function _updateFloorOpacity(active) {
    for (const [f, mesh] of Object.entries(floorMeshes)) {
      mesh.material.opacity = parseInt(f) === active ? 1.0 : 0.15
    }
    currentFloor.value = active
  }

  // ── Elevator countdown ──
  function _startElevatorCountdown() {
    clearInterval(countdownInt)
    elevatorTimer.value = elevator.getNextChangeIn()
    countdownInt = setInterval(() => {
      elevatorTimer.value = Math.max(0, elevatorTimer.value - 1)
    }, 1000)
  }

  // ── Resize ──
  function _onResize(canvas) {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
    renderer.value.setSize(w, h)
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
    let from     = agentGroup.position.clone()
    let fullPath = []
    for (const wp of waypoints) {
      const path = pathfinder.findPath(from, wp.position, elevatorOpen.value)
      if (path) fullPath = fullPath.concat(path)
      from = wp.position
    }
    if (fullPath.length > 0) {
      const smoothed = pathfinder.stringPull(fullPath)
      const pts = smoothed.map(p => new THREE.Vector3(p.x, p.y + 0.1, p.z))
      previewLine.geometry.setFromPoints(pts)
      hasPreview.value = true
    }
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
    const targetY = FLOOR_Y[floor] + 2
    camera.value.position.y = targetY + 10
    controls.value.target.y = targetY
    controls.value.update()
  }

  function setWheelchairMode(enabled) {
    pathfinder.setWheelchairMode(enabled)
  }

  function clickNavigate(event, canvas) {
    const rect   = canvas.getBoundingClientRect()
    const mouse  = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width)  * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    const ray = new THREE.Raycaster()
    ray.setFromCamera(mouse, camera.value)
    const hits = ray.intersectObjects(scene.value.children, true)
    if (hits.length > 0) {
      const pt   = hits[0].point
      const path = pathfinder.findPath(agentGroup.position.clone(), pt, elevatorOpen.value)
      if (path) {
        currentPath        = pathfinder.stringPull(path)
        finalDest          = pt
        waypointQueue      = [{ name: 'clicked point', position: pt }]
        isNavigating.value = true
        statusMsg.value    = 'Navigating to clicked point...'
        _updateFloorOpacity(getFloorFromY(pt.y))
        _updatePathLine()
      }
    }
  }

  function destroy() {
    cancelAnimationFrame(animFrameId)
    clearInterval(countdownInt)
    elevator?.destroy()
    renderer.value?.dispose()
    window.removeEventListener('resize', _onResize)
  }

  return {
    // State
    isLoading, loadingMsg, currentFloor,
    elevatorOpen, elevatorTimer,
    statusMsg, isNavigating, hasPreview,
    // Methods
    init, startNavigation, showPreview,
    cancelNavigation, focusFloor,
    setWheelchairMode, clickNavigate, destroy,
  }
}
