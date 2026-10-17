// Mission file format, shared by the game and the mission editor.
//
// {
//   "format": "lone-vector-mission", "version": 1,
//   "name", "place", "briefing": [lines], "theme": "desert" | "ice" | "lava" | "orbit" | "belt",
//   "drain", "par", "turretBurst", "seed",
//   "w", "h", "tiles": one digit per tile, row by row (0 ground/space, 1 rock, 2 floor, 3 wall),
//   "blocks": [[tx, ty], ...], "spawn": [tx, ty],
//   "entities": [{ "type", "tx", "ty", "kind"?: "E"|"P"|"M", "remote"?: true }, ...]
// }

var Mission = {
  FORMAT: 'lone-vector-mission',
  VERSION: 1,
  THEMES: ['desert', 'ice', 'lava', 'orbit', 'belt'],
  TYPES: ['core', 'boss', 'generator', 'turret', 'spawner', 'drone', 'fighter', 'mine', 'pickup'],

  // level definition the game understands
  toDef: function(m) {
    var briefing = (m.briefing || []).filter(function(l) { return l.trim() })
    return {
      name: (m.name || 'CUSTOM MISSION').toUpperCase(),
      place: (m.place || 'UNCHARTED SECTOR').toUpperCase(),
      seed: m.seed || 1,
      size: Math.max(m.w, m.h),
      theme: THEMES[m.theme] || THEMES.desert,
      drain: Number(m.drain) || 1,
      par: Number(m.par) || 240,
      turretBurst: Number(m.turretBurst) || 1,
      briefing: briefing.length ? briefing : ['Destroy every target,', 'then return to the warp gate.'],
      custom: true,
      map: m
    }
  },
  themeName: function(theme) {
    for(var k in THEMES) if(THEMES[k] == theme) return k
    return 'desert'
  },
  // snapshot a generated or edited level as a mission object
  fromLevel: function(level, info, entities) {
    var tiles = []
    for(var i = 0; i < level.tiles.length; i++) tiles.push(level.tiles[i])
    var blocks = []
    for(var k in level.blocks) blocks.push([level.blocks[k].tx, level.blocks[k].ty])
    var def = level.def
    info = info || {}
    return {
      format: this.FORMAT,
      version: this.VERSION,
      name: info.name || def.name,
      place: info.place || def.place,
      briefing: (info.briefing || def.briefing).slice(),
      theme: info.theme || this.themeName(def.theme),
      drain: info.drain || def.drain,
      par: info.par || def.par,
      turretBurst: info.turretBurst || def.turretBurst,
      seed: def.seed,
      w: level.w,
      h: level.h,
      tiles: tiles.join(''),
      blocks: blocks,
      spawn: [level.spawnTile.tx, level.spawnTile.ty],
      entities: entities || this.entitiesFromSpawns(level.spawns)
    }
  },
  entitiesFromSpawns: function(spawns) {
    var out = []
    for(var i = 0; i < spawns.length; i++) {
      var s = spawns[i], e = { type: s.type, tx: Math.floor(s.x / TS), ty: Math.floor(s.y / TS) }
      if(s.kind) e.kind = s.kind
      if(s.remote) e.remote = true
      out.push(e)
    }
    return out
  },
  // parse and sanity-check mission JSON text; throws an Error with a readable message
  parse: function(text) {
    var m = JSON.parse(text)
    if(!m || m.format != this.FORMAT) throw new Error('Not a Lone Vector mission file')
    if(!(m.w >= 16 && m.h >= 16 && m.w <= 256 && m.h <= 256)) throw new Error('Map size must be 16-256 tiles')
    if(typeof m.tiles != 'string' || m.tiles.length != m.w * m.h) throw new Error('Tile data does not match the map size')
    if(!m.spawn || m.spawn.length != 2) throw new Error('Missing landing zone')
    m.blocks = m.blocks || []
    m.entities = (m.entities || []).filter(function(e) { return Mission.TYPES.indexOf(e.type) >= 0 })
    return m
  },

  // problems a mission author should know about: [{ level: 'error' | 'warn', text, tx?, ty? }]
  validate: function(level, entities) {
    var out = [], i, e
    var targets = entities.filter(function(e) { return e.type == 'core' || e.type == 'boss' })
    if(!targets.length) out.push({ level: 'error', text: 'No targets: add a reactor core or a Mothercore' })
    var sp = level.spawnTile
    if(level.solidTerrain(sp.tx, sp.ty) || level.blocks[sp.ty * level.w + sp.tx]) {
      out.push({ level: 'error', text: 'Landing zone is inside a wall', tx: sp.tx, ty: sp.ty })
    }
    var reach = level.floodFill(sp.tx, sp.ty)
    var names = { core: 'Reactor core', boss: 'Mothercore', generator: 'Generator', turret: 'Turret', spawner: 'Spawner', drone: 'Drone', fighter: 'Fighter', mine: 'Mine', pickup: 'Pickup' }
    for(i = 0; i < entities.length; i++) {
      e = entities[i]
      if(level.solidTerrain(e.tx, e.ty)) out.push({ level: 'warn', text: names[e.type] + ' is inside a wall', tx: e.tx, ty: e.ty })
      else if(!reach[e.ty * level.w + e.tx] && (e.type == 'core' || e.type == 'boss' || e.type == 'generator')) {
        out.push({ level: 'error', text: names[e.type] + ' cannot be reached from the landing zone', tx: e.tx, ty: e.ty })
      }
    }
    // shield wiring: local generators protect cores in the same base, remote ones the Mothercore
    var bosses = entities.filter(function(e) { return e.type == 'boss' })
    for(i = 0; i < entities.length; i++) {
      e = entities[i]
      if(e.type != 'generator') continue
      if(e.remote && !bosses.length) out.push({ level: 'warn', text: 'Remote generator, but there is no Mothercore to shield', tx: e.tx, ty: e.ty })
      if(!e.remote && !Mission.shieldTargets(level, entities, e).length) {
        out.push({ level: 'warn', text: 'Generator has no cores in its base to shield', tx: e.tx, ty: e.ty })
      }
    }
    if(bosses.length > 1) out.push({ level: 'warn', text: 'More than one Mothercore' })
    return out
  },
  // entities a generator shields (same rules as the game)
  shieldTargets: function(level, entities, gen) {
    var inst = level.instAt(gen.tx, gen.ty)
    return entities.filter(function(t) {
      if(gen.remote) return t.type == 'boss'
      return t.type == 'core' && inst >= 0 && level.instAt(t.tx, t.ty) == inst
    })
  }
}
