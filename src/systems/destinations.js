import * as THREE from 'three'

// ─────────────────────────────────────────────
//  All navigable destinations
//  accessible: true = wheelchair friendly (elevator only)
// ─────────────────────────────────────────────

export const DESTINATIONS = [
  // ── Floor 1 ──
  { id: 'entrance_main', name: 'Main Entrance',    floor: 1, position: new THREE.Vector3(0, 0.3, -1),          accessible: true,  category: 'entrance'  },
  { id: 'door1',         name: 'Side Door A',      floor: 1, position: new THREE.Vector3(-2.80, 0.3, -0.06),   accessible: true,  category: 'entrance'  },
  { id: 'door3',         name: 'Side Door B',      floor: 1, position: new THREE.Vector3(2.88, 0.3, -2.53),    accessible: true,  category: 'entrance'  },
  { id: 'reception',     name: 'Reception',         floor: 1, position: new THREE.Vector3(0, 0.3, -2),          accessible: true,  category: 'service'   },
  { id: 'cafeteria',     name: 'Cafeteria',         floor: 1, position: new THREE.Vector3(0, 0.3, -6),          accessible: true,  category: 'service'   },
  { id: 'amphi_a',       name: 'Amphitheatre A',    floor: 1, position: new THREE.Vector3(3, 0.3, -5),          accessible: true,  category: 'classroom' },
  { id: 'amphi_b',       name: 'Amphitheatre B',    floor: 1, position: new THREE.Vector3(-3, 0.3, -5),         accessible: true,  category: 'classroom' },
  { id: 'wc_f1',         name: 'Restrooms (F1)',    floor: 1, position: new THREE.Vector3(-1, 0.3, -3),         accessible: true,  category: 'facility'  },
  { id: 'elevator_f1',   name: 'Elevator (F1)',     floor: 1, position: new THREE.Vector3(1.5, 0.3, -3),        accessible: true,  category: 'elevator'  },
  { id: 'stairs_f1',     name: 'Staircase (F1)',    floor: 1, position: new THREE.Vector3(-1.5, 0.3, -4),       accessible: false, category: 'stairs'    },

  // ── Floor 2 ──
  { id: 'door2',         name: 'Door Floor 2',      floor: 2, position: new THREE.Vector3(2.90, 2.3, -6.43), accessible: false, category: 'entrance'  },
  { id: 'lab_networks',  name: 'Networks Lab',      floor: 2, position: new THREE.Vector3(2, 2.3, -5),        accessible: true,  category: 'lab'       },
  { id: 'lab_telecom',   name: 'Telecom Lab',       floor: 2, position: new THREE.Vector3(-2, 2.3, -5),       accessible: true,  category: 'lab'       },
  { id: 'room_201',      name: 'Room 201',           floor: 2, position: new THREE.Vector3(3, 2.3, -3),        accessible: true,  category: 'classroom' },
  { id: 'room_202',      name: 'Room 202',           floor: 2, position: new THREE.Vector3(3, 2.3, -5),        accessible: true,  category: 'classroom' },
  { id: 'room_203',      name: 'Room 203',           floor: 2, position: new THREE.Vector3(-3, 2.3, -3),       accessible: true,  category: 'classroom' },
  { id: 'wc_f2',         name: 'Restrooms (F2)',    floor: 2, position: new THREE.Vector3(-1, 2.3, -3),       accessible: true,  category: 'facility'  },
  { id: 'elevator_f2',   name: 'Elevator (F2)',     floor: 2, position: new THREE.Vector3(1.5, 2.3, -3),      accessible: true,  category: 'elevator'  },
  { id: 'stairs_f2',     name: 'Staircase (F2)',    floor: 2, position: new THREE.Vector3(-1.5, 2.3, -4),     accessible: false, category: 'stairs'    },

  // ── Floor 3 ──
  { id: 'office_dean',   name: "Dean's Office",     floor: 3, position: new THREE.Vector3(0, 4.3, -2),          accessible: true,  category: 'office'    },
  { id: 'office_admin',  name: 'Administration',    floor: 3, position: new THREE.Vector3(2, 4.3, -2),          accessible: true,  category: 'office'    },
  { id: 'room_301',      name: 'Room 301',           floor: 3, position: new THREE.Vector3(3, 4.3, -4),          accessible: true,  category: 'classroom' },
  { id: 'room_302',      name: 'Room 302',           floor: 3, position: new THREE.Vector3(-3, 4.3, -4),         accessible: true,  category: 'classroom' },
  { id: 'wc_f3',         name: 'Restrooms (F3)',    floor: 3, position: new THREE.Vector3(-1, 4.3, -3),         accessible: true,  category: 'facility'  },
  { id: 'elevator_f3',   name: 'Elevator (F3)',     floor: 3, position: new THREE.Vector3(1.5, 4.3, -3),        accessible: true,  category: 'elevator'  },
  { id: 'stairs_f3',     name: 'Staircase (F3)',    floor: 3, position: new THREE.Vector3(-1.5, 4.3, -4),       accessible: false, category: 'stairs'    },

  // ── Floor 4 ──
  { id: 'library',       name: 'Library',            floor: 4, position: new THREE.Vector3(0, 6.3, -5),        accessible: true,  category: 'service'   },
  { id: 'study_room',    name: 'Study Room',         floor: 4, position: new THREE.Vector3(2, 6.3, -5),        accessible: true,  category: 'service'   },
  { id: 'room_401',      name: 'Room 401',           floor: 4, position: new THREE.Vector3(-2, 6.3, -5),       accessible: true,  category: 'classroom' },
  { id: 'elevator_f4',   name: 'Elevator (F4)',     floor: 4, position: new THREE.Vector3(1.5, 6.3, -3),      accessible: true,  category: 'elevator'  },
  { id: 'stairs_f4',     name: 'Staircase (F4)',    floor: 4, position: new THREE.Vector3(-1.5, 6.3, -4),     accessible: false, category: 'stairs'    },

  // ── Floor 5 ──
  { id: 'server_room',   name: 'Server Room',        floor: 5, position: new THREE.Vector3(3, 8.3, -4),         accessible: true,  category: 'lab'       },
  { id: 'conference',    name: 'Conference Room',    floor: 5, position: new THREE.Vector3(-2, 8.3, -4),        accessible: true,  category: 'office'    },
  { id: 'elevator_f5',   name: 'Elevator (F5)',     floor: 5, position: new THREE.Vector3(1.5, 8.3, -3),       accessible: true,  category: 'elevator'  },
  { id: 'stairs_f5',     name: 'Staircase (F5)',    floor: 5, position: new THREE.Vector3(-1.5, 8.3, -4),      accessible: false, category: 'stairs'    },
]

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
