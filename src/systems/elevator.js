import * as THREE from 'three'
import { ELEVATOR_POSITIONS } from './destinations.js'

const SHAFT_HEIGHT = 9.5
const ELEVATOR_Y   = { 1: 0.3, 2: 2.3, 3: 4.3, 4: 6.3, 5: 8.3 }

export class ElevatorSystem {
  constructor(scene) {
    this.scene     = scene
    this.elevators = {}
    this.listeners = []
    this._cab      = null
    this._cabFloor = 1
    this._moving   = false

    this._buildShaft()
    this._buildCab()
    this._buildDoors()

    // Initial state: cab is at F1, F1 door open, all others closed
    this._setDoor(1, true)
    for (let f = 2; f <= 5; f++) this._setDoor(f, false)
  }

  _buildShaft() {
    const mat = new THREE.MeshPhongMaterial({ color: 0x445566, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    const shaftCenterY = 0.3 + SHAFT_HEIGHT / 2
    // Back wall (now along Z axis, faces +X)
    const back  = new THREE.Mesh(new THREE.BoxGeometry(0.05, SHAFT_HEIGHT, 1.2), mat)
    back.position.set(3.6, shaftCenterY, 0)
    this.scene.add(back)

    // Side walls (along X axis)
    const left  = new THREE.Mesh(new THREE.BoxGeometry(0.65, SHAFT_HEIGHT, 0.05), mat.clone())
    left.position.set(3.33, shaftCenterY, -0.57)
    this.scene.add(left)

    const right = new THREE.Mesh(new THREE.BoxGeometry(0.65, SHAFT_HEIGHT, 0.05), mat.clone())
    right.position.set(3.33, shaftCenterY, 0.57)
    this.scene.add(right)
  }

  _buildCab() {
    const mat = new THREE.MeshPhongMaterial({ color: 0x3a5f8a, transparent: true, opacity: 0.8 })
    this._cab = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.1, 1.0), mat)
    this._cab.position.set(3.3, ELEVATOR_Y[1] + 0.55, 0)
    this.scene.add(this._cab)
  }

  _buildDoors() {
    for (const [floorStr, pos] of Object.entries(ELEVATOR_POSITIONS)) {
      const floor  = parseInt(floorStr)
      const doorY  = pos.y + 0.55

      const frameMat = new THREE.MeshPhongMaterial({ color: 0x778899 })
      const doorMat  = new THREE.MeshPhongMaterial({ color: 0x3a5f8a, transparent: true, opacity: 0.95 })
      const glowMat  = new THREE.MeshPhongMaterial({ color: 0x68d391, transparent: true, opacity: 0.3, emissive: 0x68d391, emissiveIntensity: 0.3 })

      // Door frame and panels now face -X direction (open along Z axis)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 1.1), frameMat)
      frame.position.set(pos.x, doorY, pos.z)
      this.scene.add(frame)

      const left = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.48), doorMat.clone())
      left.position.set(pos.x - 0.06, doorY, pos.z - 0.24)
      this.scene.add(left)

      const right = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.48), doorMat.clone())
      right.position.set(pos.x - 0.06, doorY, pos.z + 0.24)
      this.scene.add(right)

      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.05, 1.0), glowMat)
      glow.position.set(pos.x - 0.13, doorY, pos.z)
      glow.visible = true
      this.scene.add(glow)

      // Floor label sprite
      const label = this._makeLabel(floor, pos)
      this.scene.add(label)

      this.elevators[floor] = {
        isOpen: false,
        meshes: { left, right, glow, baseZ: pos.z, baseY: pos.y },
      }
    }
  }

  _makeLabel(floor, pos) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = '#aaccff'
    ctx.font = 'bold 32px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`F${floor}`, 32, 32)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }))
    sprite.scale.set(0.45, 0.45, 1)
    sprite.position.set(pos.x - 0.72, pos.y + 1.0, pos.z)
    return sprite
  }

  // Set a specific floor's door open or closed immediately
  _setDoor(floor, open) {
    const elev = this.elevators[floor]
    if (!elev) return
    elev.isOpen = open
    const { left, right, glow, baseZ } = elev.meshes
    if (open) {
      left.position.z  = baseZ - 0.46
      right.position.z = baseZ + 0.46
      glow.visible = true
    } else {
      left.position.z  = baseZ - 0.24
      right.position.z = baseZ + 0.24
      glow.visible = false
    }
    this.listeners.forEach(cb => cb(floor, open))
  }

  // Move cab to target floor: close current door → move → open target door
  moveCabToFloor(toFloor) {
    if (this._moving) return Promise.resolve()
    if (this._cabFloor === toFloor) {
      this._setDoor(toFloor, true)
      return Promise.resolve()
    }
    this._moving = true
    // Close current floor door
    this._setDoor(this._cabFloor, false)

    return new Promise(resolve => {
      const targetY  = ELEVATOR_Y[toFloor] + 0.55
      const startY   = this._cab.position.y
      const dist     = Math.abs(targetY - startY)
      const duration = dist * 700
      let start = null
      const tick = (ts) => {
        if (!start) start = ts
        const t    = Math.min((ts - start) / duration, 1)
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        this._cab.position.y = startY + (targetY - startY) * ease
        if (t < 1) {
          requestAnimationFrame(tick)
        } else {
          this._cabFloor = toFloor
          this._moving   = false
          this._setDoor(toFloor, true)
          resolve()
        }
      }
      requestAnimationFrame(tick)
    })
  }

  isFloorOpen(floor) { return this.elevators[floor]?.isOpen ?? false }
  getIsOpen()        { return this.isFloorOpen(this._cabFloor) }
  onChange(cb)       { this.listeners.push(cb) }

  // How long until next door change — always returns 0 (door state is cab-driven, not timed)
  getNextChangeIn()  { return 0 }

  destroy() {}
}
