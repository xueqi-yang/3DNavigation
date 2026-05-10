import * as THREE from 'three'
import { Pathfinding } from 'three-pathfinding'
import { ELEVATOR_NAV_POSITIONS, ELEVATOR_POSITIONS, getFloorFromY } from './destinations.js'

const ZONE = 'building'

export class PathfinderSystem {
  constructor() {
    this.pathfinding    = new Pathfinding()
    this.navmesh        = null
    this.ready          = false
    this.wheelchairMode = false
    this.routingStrategy = 'distance'
  }

  setNavmesh(navmeshScene) {
    navmeshScene.traverse(node => {
      if (!this.navmesh && node.isObject3D && node.children?.length > 0) {
        this.navmesh = node.children[0]
        this.pathfinding.setZoneData(ZONE, Pathfinding.createZone(this.navmesh.geometry))
        this.ready = true
        console.log('[Pathfinder] Navmesh ready ✓')
      }
    })
  }

  getNavmesh() {
    return this.navmesh
  }

  snapToNavmesh(point) {
    if (!this.ready) return null
    const groupID = this.pathfinding.getGroup(ZONE, point)
    const node    = this.pathfinding.getClosestNode(point, ZONE, groupID)
    if (!node) return null
    return { x: node.centroid.x, y: node.centroid.y, z: node.centroid.z }
  }

  setWheelchairMode(enabled) {
    this.wheelchairMode = enabled
  }

  setRoutingStrategy(strategy) {
    this.routingStrategy = strategy === 'time' ? 'time' : 'distance'
  }

  // ── Main entry: find path from A to B ──
  // Mirrors example.js: getGroup → getClosestNode → findPath
  // navmesh geometry already contains stair ramps, so A* handles floor changes naturally.
  findPath(from, to, elevatorOpen = true, strategyOverride = null) {
    if (!this.ready) return null
    const strategy = strategyOverride || this.routingStrategy

    const fromFloor = getFloorFromY(from.y)
    const toFloor   = getFloorFromY(to.y)
    console.log(`[Path:${strategy}] F${fromFloor}(${from.x.toFixed(2)},${from.y.toFixed(2)},${from.z.toFixed(2)}) -> F${toFloor}(${to.x.toFixed(2)},${to.y.toFixed(2)},${to.z.toFixed(2)})`)

    // ── Elevator vs stairs decision ──
    // Distance-only strategy:
    // d1 = walking distance outside the elevator (to elevator + from elevator)
    // d2 = full walking distance through the navmesh stairs.
    if (fromFloor !== toFloor) {
      const elevFrom = ELEVATOR_POSITIONS[fromFloor]
      const elevTo   = ELEVATOR_POSITIONS[toFloor]
      const elevNavFrom = ELEVATOR_NAV_POSITIONS[fromFloor] || elevFrom
      const elevNavTo   = ELEVATOR_NAV_POSITIONS[toFloor] || elevTo
      if (elevFrom && elevTo && elevNavFrom && elevNavTo) {
        const legA = this._navPath(from, elevNavFrom)
        const legB = this._navPath(elevNavTo, to)
        const stairPath = this._navPath(from, to)
        const cabFloor = this._getCabFloor ? this._getCabFloor() : fromFloor
        const useElev = this.wheelchairMode || this._chooseElevator(
          from, to, fromFloor, toFloor, cabFloor,
          elevNavTo, legA, legB, stairPath, elevatorOpen, strategy
        )

        if (useElev) {
          if (legA && legB) {
            console.log(`[Elevator] Selected elevator route: legA=${legA.length} pts + elevator ride + legB=${legB.length} pts`)
            return [
              ...legA,
              { x: elevFrom.x, y: elevFrom.y, z: elevFrom.z, _elevatorRide: true, _toFloor: toFloor, _landX: elevTo.x, _landY: elevTo.y, _landZ: elevTo.z },
              { x: elevTo.x, y: elevTo.y, z: elevTo.z },
              ...legB,
            ]
          }
        }

        if (stairPath) {
          console.log(`[Stairs] Selected stair route: ${stairPath.length} pts`)
          return stairPath
        }
      }
    }

    // ── Direct navmesh A* — stairs handled by navmesh geometry ──
    const path = this._navPath(from, to)
    console.log(`[Path result] ${path ? path.length + ' pts' : 'no path'}`)
    return path
  }

  // ── Allow useScene to inject cab floor getter ──
  setCabFloorGetter(fn) { this._getCabFloor = fn }

  _chooseElevator(from, to, fromFloor, toFloor, cabFloor, elevatorExit, elevatorLegA, elevatorLegB, stairPath, elevatorOpen, strategy = this.routingStrategy) {
    if (strategy === 'time') {
      return this._chooseElevatorByTime(from, to, fromFloor, toFloor, cabFloor, elevatorExit, elevatorLegA, elevatorLegB, stairPath, elevatorOpen)
    }
    return this._chooseElevatorByDistance(from, to, elevatorExit, elevatorLegA, elevatorLegB, stairPath, elevatorOpen)
  }

  // ── Distance-only comparison: elevator walking distance vs stair path length ──
  _chooseElevatorByDistance(from, to, elevatorExit, elevatorLegA, elevatorLegB, stairPath, elevatorOpen) {
    if (!elevatorLegA || !elevatorLegB) {
      console.log('[Distance comparison] Elevator route unavailable, selecting stairs')
      return false
    }
    if (!stairPath) {
      console.log('[Distance comparison] Stair route unavailable, selecting elevator')
      return true
    }

    const elevatorInDistance = this._pathLength(from, elevatorLegA)
    const elevatorOutDistance = this._pathLength(elevatorExit, elevatorLegB)
    const elevatorDistance = elevatorInDistance + elevatorOutDistance
    const stairDistance = this._pathLength(from, stairPath)

    let decision = 'stairs'
    let useElevator = false
    if (stairDistance > elevatorDistance) {
      useElevator = true
      decision = 'elevator'
    } else if (stairDistance === elevatorDistance) {
      useElevator = elevatorOpen
      decision = elevatorOpen ? 'elevator (equal distance, door open)' : 'stairs (equal distance, door closed)'
    }

    console.log(
      `[Distance comparison] d1 elevator walking=${elevatorDistance.toFixed(2)}m ` +
      `(to elevator=${elevatorInDistance.toFixed(2)}m + from elevator=${elevatorOutDistance.toFixed(2)}m)  ` +
      `d2 stairs=${stairDistance.toFixed(2)}m  ` +
      `diff(d1-d2)=${(elevatorDistance - stairDistance).toFixed(2)}m  ` +
      `door=${elevatorOpen ? 'open' : 'closed'}  -> ${decision}`
    )
    return useElevator
  }

  // ── Time-estimate comparison: converts path lengths and vertical movement into seconds ──
  _chooseElevatorByTime(from, to, fromFloor, toFloor, cabFloor, elevatorExit, elevatorLegA, elevatorLegB, stairPath, elevatorOpen) {
    if (!elevatorLegA || !elevatorLegB) {
      console.log('[Time comparison] Elevator route unavailable, selecting stairs')
      return false
    }
    if (!stairPath) {
      console.log('[Time comparison] Stair route unavailable, selecting elevator')
      return true
    }

    const WALK_SPEED = 1.4
    const ELEVATOR_ARRIVAL_PER_FLOOR = 3
    const ELEVATOR_BOARD_TIME = 4
    const ELEVATOR_RIDE_PER_FLOOR = 4
    const ELEVATOR_EXIT_TIME = 2
    const STAIR_UP_EXTRA_PER_FLOOR = 8
    const STAIR_DOWN_EXTRA_PER_FLOOR = 5

    const floorDiff = Math.abs(toFloor - fromFloor)
    const elevatorWaitFloors = Math.abs(cabFloor - fromFloor)
    const elevatorInDistance = this._pathLength(from, elevatorLegA)
    const elevatorOutDistance = this._pathLength(elevatorExit, elevatorLegB)
    const stairDistance = this._pathLength(from, stairPath)

    const elevatorWalkTime = (elevatorInDistance + elevatorOutDistance) / WALK_SPEED
    const elevatorWaitTime = elevatorWaitFloors * ELEVATOR_ARRIVAL_PER_FLOOR
    const elevatorRideTime = floorDiff * ELEVATOR_RIDE_PER_FLOOR
    const elevatorTime = elevatorWalkTime
      + elevatorWaitTime
      + ELEVATOR_BOARD_TIME
      + elevatorRideTime
      + ELEVATOR_EXIT_TIME

    const stairExtraPerFloor = toFloor > fromFloor ? STAIR_UP_EXTRA_PER_FLOOR : STAIR_DOWN_EXTRA_PER_FLOOR
    const stairWalkTime = stairDistance / WALK_SPEED
    const stairExtraTime = floorDiff * stairExtraPerFloor
    const stairTime = stairWalkTime + stairExtraTime

    let decision = 'stairs'
    let useElevator = false
    if (stairTime > elevatorTime) {
      useElevator = true
      decision = 'elevator'
    } else if (stairTime === elevatorTime) {
      useElevator = elevatorOpen
      decision = elevatorOpen ? 'elevator (equal time, door open)' : 'stairs (equal time, door closed)'
    }

    console.log(
      `[Time comparison] elevator=${elevatorTime.toFixed(2)}s ` +
      `(walk=${elevatorWalkTime.toFixed(2)}s, wait=${elevatorWaitTime.toFixed(2)}s, ` +
      `board=${ELEVATOR_BOARD_TIME.toFixed(2)}s, ride=${elevatorRideTime.toFixed(2)}s, exit=${ELEVATOR_EXIT_TIME.toFixed(2)}s)  ` +
      `stairs=${stairTime.toFixed(2)}s ` +
      `(path=${stairWalkTime.toFixed(2)}s, vertical penalty=${stairExtraTime.toFixed(2)}s)  ` +
      `diff(elevator-stairs)=${(elevatorTime - stairTime).toFixed(2)}s  ` +
      `door=${elevatorOpen ? 'open' : 'closed'}  -> ${decision}`
    )
    return useElevator
  }

  _pathLength(start, path) {
    if (!path?.length) return Infinity
    let total = 0
    let prev = start
    for (const point of path) {
      total += Math.sqrt(
        (point.x - prev.x) ** 2 +
        (point.y - prev.y) ** 2 +
        (point.z - prev.z) ** 2
      )
      prev = point
    }
    return total
  }

  // ── Core: navmesh A* from `from` to `to` ──
  // Exactly mirrors example.js findPathTo()
  _navPath(from, to) {
    const groupID     = this.pathfinding.getGroup(ZONE, from)
    const closestNode = this.pathfinding.getClosestNode(from, ZONE, groupID)
    if (!closestNode) {
      console.warn(`[A*] ❌ no node near from=(${from.x?.toFixed(2)},${from.y?.toFixed(2)},${from.z?.toFixed(2)})`)
      return null
    }
    const path = this.pathfinding.findPath(closestNode.centroid, to, ZONE, groupID)
    if (!path?.length) {
      console.warn(`[A*] ❌ no path  groupID=${groupID}`)
      return null
    }
    return path.map(p => ({ x: p.x, y: p.y, z: p.z }))
  }

  replan(currentPos, destination, elevatorOpen) {
    return this.findPath(currentPos, destination, elevatorOpen)
  }

  stringPull(path) {
    return path
  }
}
