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
    console.log(`[寻路:${strategy}] F${fromFloor}(${from.x.toFixed(2)},${from.y.toFixed(2)},${from.z.toFixed(2)}) → F${toFloor}(${to.x.toFixed(2)},${to.y.toFixed(2)},${to.z.toFixed(2)})`)

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
            console.log(`[电梯] 选电梯  legA=${legA.length}点 + 电梯段 + legB=${legB.length}点`)
            return [
              ...legA,
              { x: elevFrom.x, y: elevFrom.y, z: elevFrom.z, _elevatorRide: true, _toFloor: toFloor, _landX: elevNavTo.x, _landY: elevNavTo.y, _landZ: elevNavTo.z },
              ...legB,
            ]
          }
        }

        if (stairPath) {
          console.log(`[楼梯] 选楼梯  ${stairPath.length}点`)
          return stairPath
        }
      }
    }

    // ── Direct navmesh A* — stairs handled by navmesh geometry ──
    const path = this._navPath(from, to)
    console.log(`[寻路结果] ${path ? path.length + '点' : '❌无路径'}`)
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
      console.log('[距离比较] 电梯路线无法计算，选择楼梯')
      return false
    }
    if (!stairPath) {
      console.log('[距离比较] 楼梯路线无法计算，选择电梯')
      return true
    }

    const elevatorInDistance = this._pathLength(from, elevatorLegA)
    const elevatorOutDistance = this._pathLength(elevatorExit, elevatorLegB)
    const elevatorDistance = elevatorInDistance + elevatorOutDistance
    const stairDistance = this._pathLength(from, stairPath)

    let decision = '楼梯'
    let useElevator = false
    if (stairDistance > elevatorDistance) {
      useElevator = true
      decision = '电梯'
    } else if (stairDistance === elevatorDistance) {
      useElevator = elevatorOpen
      decision = elevatorOpen ? '电梯(距离相等且门开)' : '楼梯(距离相等且门关)'
    }

    console.log(
      `[距离比较] d1电梯外步行=${elevatorDistance.toFixed(2)}m ` +
      `(去电梯=${elevatorInDistance.toFixed(2)}m + 出电梯=${elevatorOutDistance.toFixed(2)}m)  ` +
      `d2楼梯=${stairDistance.toFixed(2)}m  ` +
      `差值(d1-d2)=${(elevatorDistance - stairDistance).toFixed(2)}m  ` +
      `门=${elevatorOpen ? '开' : '关'}  → ${decision}`
    )
    return useElevator
  }

  // ── Time-estimate comparison: converts path lengths and vertical movement into seconds ──
  _chooseElevatorByTime(from, to, fromFloor, toFloor, cabFloor, elevatorExit, elevatorLegA, elevatorLegB, stairPath, elevatorOpen) {
    if (!elevatorLegA || !elevatorLegB) {
      console.log('[时间比较] 电梯路线无法计算，选择楼梯')
      return false
    }
    if (!stairPath) {
      console.log('[时间比较] 楼梯路线无法计算，选择电梯')
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

    let decision = '楼梯'
    let useElevator = false
    if (stairTime > elevatorTime) {
      useElevator = true
      decision = '电梯'
    } else if (stairTime === elevatorTime) {
      useElevator = elevatorOpen
      decision = elevatorOpen ? '电梯(时间相等且门开)' : '楼梯(时间相等且门关)'
    }

    console.log(
      `[时间比较] 电梯=${elevatorTime.toFixed(2)}s ` +
      `(步行=${elevatorWalkTime.toFixed(2)}s, 等待=${elevatorWaitTime.toFixed(2)}s, ` +
      `进门=${ELEVATOR_BOARD_TIME.toFixed(2)}s, 运行=${elevatorRideTime.toFixed(2)}s, 出门=${ELEVATOR_EXIT_TIME.toFixed(2)}s)  ` +
      `楼梯=${stairTime.toFixed(2)}s ` +
      `(路径=${stairWalkTime.toFixed(2)}s, 上下楼惩罚=${stairExtraTime.toFixed(2)}s)  ` +
      `差值(电梯-楼梯)=${(elevatorTime - stairTime).toFixed(2)}s  ` +
      `门=${elevatorOpen ? '开' : '关'}  → ${decision}`
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
