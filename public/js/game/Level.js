// Procedural level: natural rock formations + walled grid installations

var TS = 32
var TILE = { GROUND: 0, ROCK: 1, FLOOR: 2, WALL: 3 }
var CELL = 6 // cell pitch in tiles: 5 tiles of floor + 1 wall

var Level = Base.extend({
  constructor: function(def) {
    this.def = def
    this.w = def.size
    this.h = def.size
    this.tiles = new Uint8Array(this.w * this.h)
    this.zone = new Int16Array(this.w * this.h) // installation id + 1 (incl. clear margin)
    this.blocks = {}
    this.installations = []
    this.spawns = []
    this.rng = new Rng(def.seed)
    this.generate()
  },

  inside: function(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h
  },
  get: function(tx, ty) {
    return this.inside(tx, ty) ? this.tiles[ty * this.w + tx] : TILE.ROCK
  },
  set: function(tx, ty, t) {
    if(this.inside(tx, ty)) this.tiles[ty * this.w + tx] = t
  },
  solidTerrain: function(tx, ty) {
    var t = this.get(tx, ty)
    return t == TILE.ROCK || t == TILE.WALL
  },
  solidTile: function(tx, ty) {
    return this.solidTerrain(tx, ty) || !!this.blocks[ty * this.w + tx]
  },
  solidAt: function(x, y) {
    return this.solidTile(Math.floor(x / TS), Math.floor(y / TS))
  },
  circleHits: function(x, y, r) {
    var x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS)
    var y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS)
    for(var ty = y0; ty <= y1; ty++) {
      for(var tx = x0; tx <= x1; tx++) {
        if(!this.solidTile(tx, ty)) continue
        var nx = Math.max(tx * TS, Math.min(x, tx * TS + TS))
        var ny = Math.max(ty * TS, Math.min(y, ty * TS + TS))
        var dx = x - nx, dy = y - ny
        if(dx * dx + dy * dy < r * r) return true
      }
    }
    return false
  },
  lineClear: function(x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0
    var steps = Math.ceil(Math.sqrt(dx * dx + dy * dy) / 10)
    for(var i = 1; i < steps; i++) {
      if(this.solidAt(x0 + dx * i / steps, y0 + dy * i / steps)) return false
    }
    return true
  },
  addBlock: function(tx, ty) {
    this.blocks[ty * this.w + tx] = { tx: tx, ty: ty, hp: 5, max: 5 }
  },
  blockAt: function(tx, ty) {
    return this.inside(tx, ty) ? this.blocks[ty * this.w + tx] : null
  },
  // returns true when the block was destroyed
  damageBlock: function(tx, ty, amount) {
    var key = ty * this.w + tx, b = this.blocks[key]
    if(!b) return false
    b.hp -= amount
    if(b.hp <= 0) {
      delete this.blocks[key]
      return true
    }
    return false
  },
  openAround: function(tx, ty, r) {
    for(var dy = -r; dy <= r; dy++) {
      for(var dx = -r; dx <= r; dx++) {
        if(this.solidTerrain(tx + dx, ty + dy)) return false
      }
    }
    return true
  },

  generate: function() {
    var d = this.def, rng = this.rng, w = this.w, h = this.h

    // 1. natural rock formations from noise, smoothed by a cellular automaton
    for(var ty = 0; ty < h; ty++) {
      for(var tx = 0; tx < w; tx++) {
        var n = Noise.fbm(tx * 0.11, ty * 0.11, d.seed, 3)
        var edge = Math.min(tx, ty, w - 1 - tx, h - 1 - ty)
        var solid = edge < 2 || n > d.rockiness || (edge < 4 && n > d.rockiness - 0.12)
        this.tiles[ty * w + tx] = solid ? TILE.ROCK : TILE.GROUND
      }
    }
    this.smooth(2)

    // 2. landing zone in a random corner
    var sp = rng.pick([[7, 7], [w - 8, 7], [7, h - 8], [w - 8, h - 8]])
    this.spawnTile = { tx: sp[0], ty: sp[1] }
    this.spawn = { x: (sp[0] + 0.5) * TS, y: (sp[1] + 0.5) * TS }
    this.carveDisk(sp[0], sp[1], 4.5)

    // 3. installations
    for(var i = 0; i < d.installations.length; i++) {
      this.placeInstallation(d.installations[i], i)
    }

    // 4. winding canyons from the landing zone to every installation
    for(i = 0; i < this.installations.length; i++) {
      var door = this.installations[i].door
      this.carveRoad(sp[0], sp[1], door.tx, door.ty)
    }

    // 5. seal unreachable pockets so nothing spawns where the player can't go
    var reach = this.floodFill(sp[0], sp[1])
    for(i = 0; i < w * h; i++) {
      if(!reach[i] && this.tiles[i] == TILE.GROUND) this.tiles[i] = TILE.ROCK
    }

    // 6. wandering enemies and supplies
    this.populateWild(reach)
  },

  smooth: function(passes) {
    var w = this.w, h = this.h
    for(var p = 0; p < passes; p++) {
      var next = new Uint8Array(this.tiles)
      for(var ty = 2; ty < h - 2; ty++) {
        for(var tx = 2; tx < w - 2; tx++) {
          var n = 0
          for(var dy = -1; dy <= 1; dy++) {
            for(var dx = -1; dx <= 1; dx++) {
              if((dx || dy) && this.get(tx + dx, ty + dy) == TILE.ROCK) n++
            }
          }
          if(n >= 5) next[ty * w + tx] = TILE.ROCK
          else if(n <= 2) next[ty * w + tx] = TILE.GROUND
        }
      }
      this.tiles = next
    }
  },
  carveDisk: function(cx, cy, r) {
    for(var ty = Math.floor(cy - r); ty <= Math.ceil(cy + r); ty++) {
      for(var tx = Math.floor(cx - r); tx <= Math.ceil(cx + r); tx++) {
        if(tx < 2 || ty < 2 || tx >= this.w - 2 || ty >= this.h - 2) continue
        var dx = tx - cx, dy = ty - cy
        if(dx * dx + dy * dy > r * r) continue
        var i = ty * this.w + tx
        if(this.zone[i]) continue
        this.tiles[i] = TILE.GROUND
      }
    }
  },
  carveRoad: function(x0, y0, x1, y1) {
    var x = x0, y = y0, wobble = 0, rng = this.rng
    for(var i = 0; i < 3000; i++) {
      var dx = x1 - x, dy = y1 - y, dist = Math.sqrt(dx * dx + dy * dy)
      if(dist < 1) break
      wobble = Math.max(-0.9, Math.min(0.9, wobble + rng.range(-0.35, 0.35)))
      var a = Math.atan2(dy, dx) + wobble * Math.min(1, dist / 10)
      x += Math.cos(a) * 0.7
      y += Math.sin(a) * 0.7
      this.carveDisk(x, y, 1.6)
    }
  },
  floodFill: function(sx, sy) {
    var w = this.w, reach = new Uint8Array(w * this.h)
    var stack = [sy * w + sx]
    var nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    reach[stack[0]] = 1
    while(stack.length) {
      var i = stack.pop(), tx = i % w, ty = (i / w) | 0
      for(var k = 0; k < 4; k++) {
        var nx = tx + nbs[k][0], ny = ty + nbs[k][1]
        if(!this.inside(nx, ny)) continue
        var j = ny * w + nx
        if(reach[j] || this.solidTerrain(nx, ny)) continue
        reach[j] = 1
        stack.push(j)
      }
    }
    return reach
  },
  areaFree: function(x, y, w, h) {
    for(var ty = y; ty < y + h; ty++) {
      for(var tx = x; tx < x + w; tx++) {
        if(this.inside(tx, ty) && this.zone[ty * this.w + tx]) return false
      }
    }
    // keep away from the landing zone
    var sx = this.spawnTile.tx, sy = this.spawnTile.ty
    var dx = Math.max(x - sx, 0, sx - (x + w)), dy = Math.max(y - sy, 0, sy - (y + h))
    return dx * dx + dy * dy > 14 * 14
  },

  placeInstallation: function(spec, id) {
    var rng = this.rng
    var W = spec.cols * CELL + 1, H = spec.rows * CELL + 1
    var ox, oy, ok = false
    for(var tries = 0; tries < 1000 && !ok; tries++) {
      if(spec.center) {
        ox = ((this.w - W) >> 1) + rng.int(-3, 3)
        oy = ((this.h - H) >> 1) + rng.int(-3, 3)
      } else {
        ox = rng.int(4, this.w - 4 - W)
        oy = rng.int(4, this.h - 4 - H)
      }
      var m = tries < 700 ? 5 : 3
      ok = this.areaFree(ox - m, oy - m, W + 2 * m, H + 2 * m)
    }
    if(!ok) {
      console.warn('Could not place installation ' + id)
      return
    }
    var inst = { id: id, ox: ox, oy: oy, W: W, H: H, spec: spec }
    this.installations.push(inst)

    // clear margin of open ground around the compound
    for(var ty = oy - 2; ty <= oy + H + 1; ty++) {
      for(var tx = ox - 2; tx <= ox + W + 1; tx++) {
        this.set(tx, ty, TILE.GROUND)
        this.zone[ty * this.w + tx] = id + 1
      }
    }
    // walls on the grid lines, metal floor inside cells
    for(var ly = 0; ly < H; ly++) {
      for(var lx = 0; lx < W; lx++) {
        this.set(ox + lx, oy + ly, (lx % CELL == 0 || ly % CELL == 0) ? TILE.WALL : TILE.FLOOR)
      }
    }

    // doors: random spanning tree over the cells, plus a few loops
    var cols = spec.cols, rows = spec.rows, seen = {}
    var start = [rng.int(0, cols - 1), rng.int(0, rows - 1)]
    var stack = [start]
    seen[start[0] + ',' + start[1]] = true
    while(stack.length) {
      var cur = stack[stack.length - 1], options = []
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      for(var k = 0; k < 4; k++) {
        var nc = cur[0] + dirs[k][0], nr = cur[1] + dirs[k][1]
        if(nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen[nc + ',' + nr]) options.push([nc, nr])
      }
      if(!options.length) {
        stack.pop()
        continue
      }
      var nxt = rng.pick(options)
      this.openDoor(inst, cur[0], cur[1], nxt[0], nxt[1], rng.chance(spec.blockChance || 0))
      seen[nxt[0] + ',' + nxt[1]] = true
      stack.push(nxt)
    }
    for(var r = 0; r < rows; r++) {
      for(var c = 0; c < cols; c++) {
        if(c + 1 < cols && rng.chance(0.3)) this.openDoor(inst, c, r, c + 1, r, rng.chance(spec.blockChance || 0))
        if(r + 1 < rows && rng.chance(0.3)) this.openDoor(inst, c, r, c, r + 1, rng.chance(spec.blockChance || 0))
      }
    }

    // entrances through the outer wall
    for(var e = 0; e < (spec.entrances || 1); e++) {
      var side = rng.int(0, 3), door
      var cell = rng.int(0, (side < 2 ? cols : rows) - 1)
      for(k = 2; k <= 4; k++) {
        if(side == 0) this.set(ox + cell * CELL + k, oy, TILE.FLOOR)
        if(side == 1) this.set(ox + cell * CELL + k, oy + H - 1, TILE.FLOOR)
        if(side == 2) this.set(ox, oy + cell * CELL + k, TILE.FLOOR)
        if(side == 3) this.set(ox + W - 1, oy + cell * CELL + k, TILE.FLOOR)
      }
      if(side == 0) door = { tx: ox + cell * CELL + 3, ty: oy - 2 }
      if(side == 1) door = { tx: ox + cell * CELL + 3, ty: oy + H + 1 }
      if(side == 2) door = { tx: ox - 2, ty: oy + cell * CELL + 3 }
      if(side == 3) door = { tx: ox + W + 1, ty: oy + cell * CELL + 3 }
      if(!inst.door) inst.door = door
    }

    // fill the cells
    var cells = []
    for(r = 0; r < rows; r++) {
      for(c = 0; c < cols; c++) {
        cells.push({ x: (ox + c * CELL + 3.5) * TS, y: (oy + r * CELL + 3.5) * TS })
      }
    }
    rng.shuffle(cells)
    if(spec.boss) {
      var mx = (ox + W / 2) * TS, my = (oy + H / 2) * TS
      cells.sort(function(a, b) {
        return Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my)
      })
    }
    var self = this
    var take = function(n, type, extra) {
      for(var i = 0; i < (n || 0) && cells.length; i++) {
        var cl = cells.shift()
        var s = { type: type, x: cl.x, y: cl.y, inst: id }
        for(var key in extra) s[key] = extra[key]
        self.spawns.push(s)
      }
    }
    take(spec.boss, 'boss')
    take(spec.cores, 'core')
    take(spec.gens, 'generator', { remote: false })
    take(spec.remoteGens, 'generator', { remote: true })
    take(spec.spawners, 'spawner')
    take(spec.turrets, 'turret')
    while(cells.length) {
      var cl = cells.shift()
      if(rng.chance(0.7)) this.spawns.push({ type: 'pickup', kind: rng.pick(['E', 'E', 'P', 'M']), x: cl.x, y: cl.y, inst: id })
    }

    // mines scattered in the clearing around the walls
    for(var mi = 0; mi < (spec.mines || 0); mi++) {
      for(tries = 0; tries < 30; tries++) {
        tx = rng.int(ox - 2, ox + W + 1)
        ty = rng.int(oy - 2, oy + H + 1)
        if(tx >= ox && tx < ox + W && ty >= oy && ty < oy + H) continue
        if(Math.abs(tx - inst.door.tx) + Math.abs(ty - inst.door.ty) < 3) continue
        this.spawns.push({ type: 'mine', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, inst: id })
        break
      }
    }
  },
  openDoor: function(inst, c0, r0, c1, r1, blocked) {
    for(var k = 2; k <= 4; k++) {
      var tx, ty
      if(r0 == r1) {
        tx = inst.ox + Math.max(c0, c1) * CELL
        ty = inst.oy + r0 * CELL + k
      } else {
        tx = inst.ox + c0 * CELL + k
        ty = inst.oy + Math.max(r0, r1) * CELL
      }
      this.set(tx, ty, TILE.FLOOR)
      if(blocked) this.addBlock(tx, ty)
    }
  },

  populateWild: function(reach) {
    var w = this.w, h = this.h, rng = this.rng, wild = this.def.wild
    var cand = []
    for(var ty = 2; ty < h - 2; ty++) {
      for(var tx = 2; tx < w - 2; tx++) {
        var i = ty * w + tx
        if(!reach[i] || this.tiles[i] != TILE.GROUND || this.zone[i]) continue
        var dx = tx - this.spawnTile.tx, dy = ty - this.spawnTile.ty
        if(dx * dx + dy * dy < 14 * 14) continue
        if(!this.openAround(tx, ty, 1)) continue
        cand.push(i)
      }
    }
    if(!cand.length) return
    var used = [], self = this
    var place = function(type, n, kind) {
      for(var k = 0; k < (n || 0); k++) {
        for(var tries = 0; tries < 30; tries++) {
          var i = rng.pick(cand), tx = i % w, ty = (i / w) | 0
          var near = false
          for(var u = 0; u < used.length; u++) {
            if(Math.abs(used[u][0] - tx) + Math.abs(used[u][1] - ty) < 4) {
              near = true
              break
            }
          }
          if(near) continue
          used.push([tx, ty])
          self.spawns.push({ type: type, kind: kind, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, inst: -1 })
          break
        }
      }
    }
    place('turret', wild.turret)
    place('mine', wild.mine)
    place('drone', wild.drone)
    place('fighter', wild.fighter)
    place('pickup', wild.E, 'E')
    place('pickup', wild.P, 'P')
    place('pickup', wild.M, 'M')
  }
})
