import * as THREE from 'three'

export const DESTINATIONS = []

export const CATEGORY_ICONS = {
  entrance:  '↗',
  classroom: '▣',
  lab:       '⬡',
  office:    '◈',
  service:   '◉',
  facility:  '○',
  elevator:  '▲',
  stairs:    '╱',
}

export const ELEVATOR_POSITIONS = {
  1: new THREE.Vector3(3, 0.259,  0),
  2: new THREE.Vector3(3, 2.259,  0),
  3: new THREE.Vector3(3, 4.259,  0),
  4: new THREE.Vector3(3, 6.259,  0),
  5: new THREE.Vector3(3, 8.259,  0),
}

// Points used only for navmesh path calculation.
// Keep these on walkable navmesh near the elevator door. The elevator model,
// doors, cab animation, and ride marker still use ELEVATOR_POSITIONS.
export const ELEVATOR_NAV_POSITIONS = {
  1: new THREE.Vector3(2.7, 0.26, 0),
  2: new THREE.Vector3(2.7, 2.26, 0),
  3: new THREE.Vector3(2.7, 4.26,  0),
  4: new THREE.Vector3(2.7, 6.26,  0),
  5: new THREE.Vector3(2.7, 8.26,  0),
}

// STAIR_SEGMENTS — navmesh-exact entry/exit per floor.
// Each Z-column is a separate staircase. Within one column, the flat-vert center
// on each floor is independently measured — different XZ means there is a corridor
// walk between them (handled by _floorPath in _multiFloorPath).
// `from` = flat entry at lower floor, `to` = flat exit at upper floor.
//
// Z-column labels (by approx Z):
//   'E': Z≈-4.6   F1↔F2, F2↔F3, F3↔F4
//   'F': Z≈-3.9   F1↔F2, F2↔F3, F3↔F4
//   'G': Z≈-3.1   F2↔F3, F3↔F4, F4↔F5
//   'H': Z≈+0.1   F2↔F3, F3↔F4, F4↔F5
//   'I': Z≈+2.8   F1↔F2, F2↔F3, F3↔F4
export const STAIR_SEGMENTS = [
  // ── Column E (Z≈-4.6) ──
  { floors: [1, 2], stair: 'E', from: new THREE.Vector3( 3.135, 0.259, -4.126), to: new THREE.Vector3(-1.665, 2.259, -5.326) },
  { floors: [2, 3], stair: 'E', from: new THREE.Vector3(-1.665, 2.259, -5.326), to: new THREE.Vector3( 3.135, 4.259, -4.126) },
  { floors: [3, 4], stair: 'E', from: new THREE.Vector3( 3.135, 4.259, -4.126), to: new THREE.Vector3(-1.665, 6.259, -5.326) },
  // ── Column F (Z≈-3.9) ──
  { floors: [1, 2], stair: 'F', from: new THREE.Vector3( 2.435, 0.259, -3.826), to: new THREE.Vector3(-2.732, 2.259, -4.726) },
  { floors: [2, 3], stair: 'F', from: new THREE.Vector3(-2.732, 2.259, -4.726), to: new THREE.Vector3( 2.335, 4.259, -3.726) },
  { floors: [3, 4], stair: 'F', from: new THREE.Vector3( 2.335, 4.259, -3.726), to: new THREE.Vector3(-2.732, 6.259, -4.726) },
  // ── Column G (Z≈-3.1) ──
  { floors: [2, 3], stair: 'G', from: new THREE.Vector3(-3.265, 2.259, -3.326), to: new THREE.Vector3( 1.135, 4.259, -3.126) },
  { floors: [3, 4], stair: 'G', from: new THREE.Vector3( 1.135, 4.259, -3.126), to: new THREE.Vector3(-3.265, 6.259, -3.326) },
  { floors: [4, 5], stair: 'G', from: new THREE.Vector3(-3.265, 6.259, -3.326), to: new THREE.Vector3( 1.335, 8.259, -3.726) },
  // ── Column H (Z≈+0.1) ──
  { floors: [2, 3], stair: 'H', from: new THREE.Vector3( 2.468, 2.259,  0.007), to: new THREE.Vector3(-1.899, 4.259, -0.460) },
  { floors: [3, 4], stair: 'H', from: new THREE.Vector3(-1.899, 4.259, -0.460), to: new THREE.Vector3( 2.468, 6.259,  0.007) },
  { floors: [4, 5], stair: 'H', from: new THREE.Vector3( 2.468, 6.259,  0.007), to: new THREE.Vector3(-1.565, 8.259,  0.674) },
  // ── Column I (Z≈+2.8) ──
  { floors: [1, 2], stair: 'I', from: new THREE.Vector3(-3.265, 0.259,  3.474), to: new THREE.Vector3( 1.535, 2.259,  2.074) },
  { floors: [2, 3], stair: 'I', from: new THREE.Vector3( 1.535, 2.259,  2.074), to: new THREE.Vector3(-3.265, 4.259,  3.474) },
  { floors: [3, 4], stair: 'I', from: new THREE.Vector3(-3.265, 4.259,  3.474), to: new THREE.Vector3( 1.535, 6.259,  2.074) },
]

// Legacy aliases — kept so other files that import them don't break
export const STAIR_R_POSITIONS = {
  1: new THREE.Vector3( 3.135, 0.259, -4.126),  // Col E F1
  2: new THREE.Vector3(-1.665, 2.259, -5.326),  // Col E F2
  3: new THREE.Vector3( 3.135, 4.259, -4.126),  // Col E F3
  4: new THREE.Vector3(-1.665, 6.259, -5.326),  // Col E F4
  5: new THREE.Vector3( 1.335, 8.259, -3.726),  // Col G F5
}
export const STAIR_L_POSITIONS = {
  1: new THREE.Vector3(-3.265, 0.259,  3.474),  // Col I F1
  2: new THREE.Vector3( 1.535, 2.259,  2.074),  // Col I F2
  3: new THREE.Vector3(-3.265, 4.259,  3.474),  // Col I F3
  4: new THREE.Vector3( 1.535, 6.259,  2.074),  // Col I F4
  5: new THREE.Vector3(-1.565, 8.259,  0.674),  // Col H F5
}
export const STAIR_POSITIONS = STAIR_R_POSITIONS

export const FLOOR_Y = { 1: 0.259, 2: 2.259, 3: 4.259, 4: 6.259, 5: 8.259 }

export function getFloorFromY(y) {
  if (y < 1.259) return 1
  if (y < 3.259) return 2
  if (y < 5.259) return 3
  if (y < 7.259) return 4
  return 5
}

export function searchDestinations(query, wheelchairMode = false) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return DESTINATIONS.filter(d => {
    if (d.category === 'elevator' || d.category === 'stairs') return false
    if (wheelchairMode && !d.accessible) return false
    return d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
  }).slice(0, 8)
}
