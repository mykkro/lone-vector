// Visual themes and the three missions

var THEMES = {
  desert: {
    name: 'desert',
    groundA: [128, 92, 58], groundB: [200, 160, 104],
    rockA: [84, 56, 40], rockB: [146, 102, 70],
    metal: [112, 116, 122], wall: [74, 78, 88],
    accent: [255, 170, 60]
  },
  ice: {
    name: 'ice',
    groundA: [140, 170, 196], groundB: [214, 232, 244],
    rockA: [52, 74, 102], rockB: [102, 130, 162],
    metal: [96, 108, 124], wall: [56, 66, 86],
    accent: [90, 220, 255]
  },
  lava: {
    name: 'lava',
    groundA: [36, 30, 32], groundB: [84, 66, 60],
    rockA: [22, 18, 20], rockB: [70, 56, 54],
    metal: [92, 86, 92], wall: [52, 46, 56],
    accent: [255, 90, 40],
    glow: [255, 120, 30]
  },
  // space themes: open ground is empty space, rock becomes asteroids
  orbit: {
    name: 'orbit',
    space: true,
    rockA: [62, 62, 72], rockB: [132, 130, 140],
    metal: [118, 126, 142], wall: [62, 70, 90],
    accent: [120, 200, 255],
    nebulaA: [70, 24, 110], nebulaB: [20, 70, 130]
  },
  belt: {
    name: 'belt',
    space: true,
    rockA: [70, 52, 44], rockB: [150, 118, 92],
    metal: [126, 118, 110], wall: [76, 66, 64],
    accent: [255, 200, 80],
    nebulaA: [130, 40, 26], nebulaB: [50, 22, 80]
  }
}

// Installation spec: grid of cols x rows cells (5x5 tiles each, walled),
// filled with targets / defences. Generators shield the cores of their own
// installation; remote generators shield the Mothercore instead.
var LEVELS = [
  {
    name: 'OUTPOST KESTREL',
    place: 'DESERT MOON KESTREL IV',
    seed: 4127,
    size: 64,
    theme: THEMES.desert,
    rockiness: 0.6,
    drain: 0.8,
    par: 180,
    turretBurst: 1,
    briefing: [
      'Enemy relay outposts have been detected',
      'in the dune fields of Kestrel IV.',
      'Locate the installations and destroy',
      'every reactor core, then return to',
      'the warp gate at the landing zone.'
    ],
    installations: [
      { cols: 2, rows: 2, cores: 2, turrets: 1, entrances: 2, blockChance: 0, mines: 2 },
      { cols: 3, rows: 2, cores: 2, turrets: 3, entrances: 1, blockChance: 0.35, mines: 3 }
    ],
    wild: { drone: 12, fighter: 0, turret: 3, mine: 4, E: 5, P: 2, M: 2 }
  },
  {
    name: 'CRYO RELAY',
    place: 'ICE FIELDS OF NIFLHEIM',
    seed: 9902,
    size: 76,
    theme: THEMES.ice,
    rockiness: 0.58,
    drain: 1.0,
    par: 240,
    turretBurst: 2,
    briefing: [
      'The relay cores here are protected by',
      'shield generators. Follow the energy',
      'conduits, knock out the generators,',
      'then destroy the exposed cores.'
    ],
    installations: [
      { cols: 2, rows: 2, cores: 1, gens: 1, turrets: 2, entrances: 1, blockChance: 0.2, mines: 3 },
      { cols: 3, rows: 2, cores: 2, gens: 1, turrets: 2, spawners: 1, entrances: 2, blockChance: 0.3, mines: 3 },
      { cols: 2, rows: 3, cores: 2, gens: 1, turrets: 3, entrances: 1, blockChance: 0.4, mines: 2 }
    ],
    wild: { drone: 12, fighter: 6, turret: 5, mine: 8, E: 6, P: 2, M: 3 }
  },
  {
    name: 'ORBITAL DOCKS',
    place: 'HIGH ORBIT ABOVE NIFLHEIM',
    seed: 5150,
    size: 80,
    theme: THEMES.orbit,
    rockiness: 0.68,
    drain: 1.0,
    par: 260,
    turretBurst: 2,
    briefing: [
      'The relays were fed from orbital docks.',
      'There is no ground up here - your engines',
      'never stop. Hold a direction to boost,',
      'brake to slip through the station hatches.'
    ],
    installations: [
      { cols: 3, rows: 2, cores: 2, gens: 1, turrets: 2, spawners: 1, entrances: 2, blockChance: 0.2, mines: 3 },
      { cols: 2, rows: 2, cores: 1, turrets: 3, entrances: 2, blockChance: 0, mines: 2 },
      { cols: 2, rows: 3, cores: 2, gens: 1, turrets: 3, entrances: 2, blockChance: 0.3, mines: 3 }
    ],
    wild: { drone: 14, fighter: 10, turret: 2, mine: 10, E: 7, P: 2, M: 3 }
  },
  {
    name: 'THE DARK BELT',
    place: 'ASTEROID BELT OF GEHENNA',
    seed: 777,
    size: 84,
    theme: THEMES.belt,
    rockiness: 0.6,
    drain: 1.1,
    par: 280,
    turretBurst: 2,
    briefing: [
      'Fuel depots hidden in the asteroid belt',
      'keep the Citadel running. Thread the',
      'rocks, find the depots and burn them out',
      'before we descend to Gehenna Prime.'
    ],
    installations: [
      { cols: 2, rows: 2, cores: 1, gens: 1, turrets: 2, entrances: 2, blockChance: 0.2, mines: 3 },
      { cols: 3, rows: 2, cores: 2, gens: 1, turrets: 2, spawners: 1, entrances: 2, blockChance: 0.3, mines: 3 },
      { cols: 2, rows: 2, cores: 2, turrets: 2, entrances: 2, blockChance: 0.2, mines: 3 }
    ],
    wild: { drone: 14, fighter: 12, turret: 2, mine: 12, E: 8, P: 2, M: 4 }
  },
  {
    name: 'THE CITADEL',
    place: 'MAGMA WORLD GEHENNA PRIME',
    seed: 31337,
    size: 90,
    theme: THEMES.lava,
    rockiness: 0.6,
    drain: 1.15,
    par: 330,
    turretBurst: 3,
    briefing: [
      'The enemy Mothercore lies inside the',
      'Citadel. Its shield is fed by two remote',
      'outposts - destroy their generators first.',
      'Then breach the Citadel and end this war.'
    ],
    installations: [
      { center: true, cols: 4, rows: 4, boss: 1, cores: 2, gens: 1, turrets: 5, spawners: 2, entrances: 2, blockChance: 0.35, mines: 4 },
      { cols: 2, rows: 2, cores: 1, remoteGens: 1, turrets: 2, entrances: 1, blockChance: 0.3, mines: 3 },
      { cols: 2, rows: 2, cores: 1, remoteGens: 1, turrets: 1, spawners: 1, entrances: 1, blockChance: 0.3, mines: 3 }
    ],
    wild: { drone: 14, fighter: 10, turret: 6, mine: 10, E: 8, P: 2, M: 4 }
  }
]
