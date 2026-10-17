// Game states, world simulation, collisions, camera and HUD

var RADAR_RANGE = 1200

var Game = Base.extend({
  constructor: function(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.W = canvas.width
    this.H = canvas.height
    this.state = 'title'
    this.stateTime = 0
    this.missions = LEVELS
    this.custom = null // 'editor' (play-testing from the mission editor) or 'file' (dropped mission file)
    this.score = 0
    this.hiscore = this.loadHiscore()
    this.lives = 3
    this.paused = false
    this.shake = 0
    this.camX = 0
    this.camY = 0
    this.particles = new Particles()
    this.messages = []
    this.delayed = []
    this.stars = []
    var rng = new Rng(42)
    for(var i = 0; i < 220; i++) this.stars.push({ x: rng.range(0, this.W), y: rng.range(0, this.H), z: rng.range(0.15, 1) })
    this.planet = Gfx.makePlanet(160, 5)
    this.vignette = this.makeVignette()
  },
  makeVignette: function() {
    var c = Gfx.canvas(this.W, this.H), g = c.getContext('2d')
    var grad = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.45, this.W / 2, this.H / 2, this.W * 0.65)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.5)')
    g.fillStyle = grad
    g.fillRect(0, 0, this.W, this.H)
    return c
  },
  loadHiscore: function() {
    try {
      return parseInt(localStorage.getItem('lonevector.hiscore'), 10) || 10000
    } catch(e) {
      return 10000
    }
  },
  saveHiscore: function() {
    if(this.score <= this.hiscore) return
    this.hiscore = this.score
    try {
      localStorage.setItem('lonevector.hiscore', String(this.hiscore))
    } catch(e) {
    }
  },

  run: function() {
    var self = this
    this.lastTime = Date.now()
    var loop = function() {
      var now = Date.now()
      var dt = Math.min(0.033, (now - self.lastTime) / 1000)
      self.lastTime = now
      self.update(dt)
      self.render()
      requestAnimationFrame(loop)
    }
    loop()
  },
  setState: function(s) {
    this.state = s
    this.stateTime = 0
    input.flush()
  },
  confirm: function() {
    return input.consume('ENTER') || input.consume('SPACE')
  },

  // ------------------------------------------------------------ flow

  newGame: function() {
    this.score = 0
    this.lives = 3
    this.carry = { weapon: 1, missiles: 5 }
    this.startLevel(0)
  },
  // play a single mission from a mission file (see Mission.js)
  playCustom: function(m, source) {
    this.custom = source
    this.missions = [Mission.toDef(m)]
    this.newGame()
  },
  // after a custom mission: replay it when testing from the editor, else back to the campaign
  customDone: function() {
    if(this.custom == 'editor') {
      this.newGame()
      return
    }
    this.custom = null
    this.missions = LEVELS
    this.setState('title')
  },
  startLevel: function(i) {
    var def = this.missions[i]
    this.levelIndex = i
    this.level = new Level(def)
    this.terrain = new Terrain(this.level)
    this.particles = new Particles()
    this.enemies = []
    this.shots = []
    this.eshots = []
    this.pickups = []
    this.messages = []
    this.delayed = []
    this.levelTime = 0
    this.alarmTimer = 0
    this.paused = false
    var lv = this.level
    this.player = new Player(this, lv.spawn.x, lv.spawn.y)
    this.player.weapon = this.carry.weapon
    this.player.missiles = this.carry.missiles
    // start facing the middle of the map (matters in space, where the ship never stops)
    var toCenter = Math.atan2(lv.w * TS / 2 - lv.spawn.x, lv.spawn.y - lv.h * TS / 2)
    this.player.heading = Math.round(toCenter / (Math.PI / 4)) & 7
    this.player.viewAngle = this.player.heading * Math.PI / 4
    this.checkpoint = { x: lv.spawn.x, y: lv.spawn.y }
    this.gate = new WarpGate(this, lv.spawn.x, lv.spawn.y)

    var kinds = { drone: Drone, fighter: Fighter, turret: Turret, mine: Mine, spawner: Spawner, core: Core, generator: Generator, boss: Mothercore }
    for(var k = 0; k < lv.spawns.length; k++) {
      var s = lv.spawns[k]
      if(s.type == 'pickup') {
        this.pickups.push(new Pickup(this, s.x, s.y, s.kind, 0))
        continue
      }
      var e = new kinds[s.type](this, s.x, s.y)
      e.inst = s.inst
      e.remote = !!s.remote
      this.enemies.push(e)
    }
    // wire shield generators to the targets they protect
    for(k = 0; k < this.enemies.length; k++) {
      var gen = this.enemies[k]
      if(!(gen instanceof Generator)) continue
      for(var j = 0; j < this.enemies.length; j++) {
        var t = this.enemies[j]
        var mine = gen.remote ? t instanceof Mothercore : (t instanceof Core && gen.inst >= 0 && t.inst == gen.inst)
        if(mine) {
          gen.protects.push(t)
          t.shieldedBy.push(gen)
        }
      }
    }
    this.targetsTotal = this.targetsLeft()
    // a custom mission without targets is just a flight to the gate
    if(!this.targetsTotal) this.gate.active = true
    this.updateCamera(0, true)
    this.setState('briefing')
  },
  targetsLeft: function() {
    var n = 0
    for(var i = 0; i < this.enemies.length; i++) if(this.enemies[i].isTarget && this.enemies[i].alive) n++
    return n
  },
  levelComplete: function() {
    var p = this.player
    Sfx.play('warp')
    this.particles.burst(p.x, p.y, 40, 300, 0.8, 2, [90, 255, 200])
    p.alive = false
    this.bonus = {
      energy: Math.floor(Math.max(0, p.energy)) * 20,
      time: Math.max(0, Math.floor(this.missions[this.levelIndex].par - this.levelTime)) * 25
    }
    this.score += this.bonus.energy + this.bonus.time
    this.carry = { weapon: p.weapon, missiles: p.missiles }
    this.saveHiscore()
    this.setState('complete')
  },
  playerDied: function() {
    var p = this.player
    if(!p.alive) return
    p.alive = false
    this.particles.explosion(p.x, p.y, 2.5)
    this.shake = 25
    Sfx.play('die')
    this.lives--
    this.respawnTimer = 2.5
    this.message(this.lives >= 0 ? 'SHIP LOST' : 'NO SHIPS LEFT', '#ff6050')
  },
  respawn: function() {
    var old = this.player
    if(this.lives < 0) {
      this.saveHiscore()
      this.setState('gameover')
      return
    }
    var spot = this.findOpenSpot(this.checkpoint.x, this.checkpoint.y, 14)
    var p = this.player = new Player(this, spot.x, spot.y)
    p.weapon = Math.max(1, old.weapon - 1)
    p.missiles = Math.max(3, old.missiles)
    p.invuln = 3
    p.heading = old.heading
    p.viewAngle = old.heading * Math.PI / 4
    this.message('ENERGY RESTORED', '#8dffa8')
  },
  findOpenSpot: function(x, y, r) {
    var lv = this.level
    for(var rad = 0; rad < 12; rad++) {
      for(var a = 0; a < 16; a++) {
        var px = x + Math.cos(a * Math.PI / 8) * rad * TS, py = y + Math.sin(a * Math.PI / 8) * rad * TS
        if(!lv.circleHits(px, py, r + 4) && !this.solidEnemyNear(px, py, r + 8)) return { x: px, y: py }
        if(rad == 0) break
      }
    }
    return { x: lv.spawn.x, y: lv.spawn.y }
  },
  solidEnemyNear: function(x, y, r) {
    for(var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i]
      if(e.alive && e.solid && Math.hypot(e.x - x, e.y - y) < e.r + r) return true
    }
    return false
  },
  message: function(text, color) {
    this.messages.push({ text: text, color: color || '#fff', t: 3 })
    if(this.messages.length > 3) this.messages.shift()
  },

  // ------------------------------------------------------------ update

  update: function(dt) {
    this.stateTime += dt
    if(input.consume('m')) Sfx.toggleMute()
    switch(this.state) {
      case 'title':
        if(this.confirm()) this.newGame()
        break
      case 'waiting':
        // embedded in the mission editor until it sends a mission
        break
      case 'briefing':
        this.terrain.prerender(12)
        if(this.terrain.progress() >= 1 && this.stateTime > 0.8 && this.confirm()) {
          this.setState('play')
          this.message(this.missions[this.levelIndex].name, '#ffd27a')
          if(this.missions[this.levelIndex].theme.space) {
            this.message('ENGINES NEVER STOP - ' + (TouchPad.active ? 'BRAKE BUTTON' : 'SHIFT') + ' TO BRAKE', '#9ad4ff')
          }
          Sfx.play('start')
        }
        break
      case 'play':
        this.updatePlay(dt)
        break
      case 'complete':
        this.particles.update(dt)
        if(this.stateTime > 1.2 && this.confirm()) {
          if(this.custom) this.customDone()
          else if(this.levelIndex + 1 < this.missions.length) this.startLevel(this.levelIndex + 1)
          else this.setState('victory')
        }
        break
      case 'gameover':
        this.particles.update(dt)
        if(this.stateTime > 1.5 && this.confirm()) {
          if(this.custom) this.customDone()
          else this.setState('title')
        }
        break
      case 'victory':
        if(Math.random() < dt * 4) {
          this.particles.explosion(Math.random() * this.W, Math.random() * this.H * 0.6, 0.6 + Math.random())
        }
        this.particles.update(dt)
        if(this.stateTime > 2 && this.confirm()) {
          this.particles = new Particles()
          this.setState('title')
        }
        break
    }
  },
  updatePlay: function(dt) {
    if(input.consume('p') || input.consume('ESC')) this.paused = !this.paused
    if(this.paused) return
    this.levelTime += dt
    var p = this.player, i

    if(p.alive) p.update(dt)
    else {
      this.respawnTimer -= dt
      if(this.respawnTimer <= 0) {
        this.respawn()
        if(this.state != 'play') return
        p = this.player
      }
    }
    for(i = 0; i < this.enemies.length; i++) if(this.enemies[i].alive) this.enemies[i].update(dt)
    for(i = 0; i < this.shots.length; i++) if(this.shots[i].alive) this.shots[i].update(dt)
    for(i = 0; i < this.eshots.length; i++) if(this.eshots[i].alive) this.eshots[i].update(dt)
    for(i = 0; i < this.pickups.length; i++) if(this.pickups[i].alive) this.pickups[i].update(dt)
    this.gate.update(dt)

    // chained secondary explosions after big kills
    for(i = this.delayed.length - 1; i >= 0; i--) {
      var d = this.delayed[i]
      d.t -= dt
      if(d.t <= 0) {
        this.particles.explosion(d.x, d.y, d.s)
        this.shake = Math.min(20, this.shake + 5)
        Sfx.play('explode')
        this.delayed.splice(i, 1)
      }
    }
    this.particles.update(dt)
    this.collide()

    this.enemies = this.filterAlive(this.enemies)
    this.shots = this.filterAlive(this.shots)
    this.eshots = this.filterAlive(this.eshots)
    this.pickups = this.filterAlive(this.pickups)

    this.updateCamera(dt)
    for(i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].t -= dt
      if(this.messages[i].t <= 0) this.messages.splice(i, 1)
    }
    // radar discovery
    for(i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i]
      if((e.isTarget || e instanceof Generator) && !e.discovered && p.dist(e) < RADAR_RANGE) e.discovered = true
    }
    if(p.alive && p.energy < 25) {
      this.alarmTimer -= dt
      if(this.alarmTimer <= 0) {
        Sfx.play('alarm')
        this.alarmTimer = 0.7
      }
    }
    if(this.gate.active && p.alive && p.dist(this.gate) < 34) this.levelComplete()
  },
  filterAlive: function(list) {
    var out = []
    for(var i = 0; i < list.length; i++) if(list[i].alive) out.push(list[i])
    return out
  },
  collide: function() {
    var p = this.player, i, j, s, e, d
    for(i = 0; i < this.shots.length; i++) {
      s = this.shots[i]
      if(!s.alive) continue
      for(j = 0; j < this.enemies.length; j++) {
        e = this.enemies[j]
        if(!e.alive) continue
        var rr = e.r + s.r
        if(Math.abs(e.x - s.x) > rr || Math.abs(e.y - s.y) > rr || s.dist(e) > rr) continue
        s.alive = false
        if(e.hit(s.dmg)) {
          this.particles.burst(s.x, s.y, s.missile ? 14 : 4, 180, 0.25, 1.5, [255, 210, 140])
          if(s.missile) this.particles.explosion(s.x, s.y, 0.6)
          if(s.missile) Sfx.play('explode')
        } else {
          this.particles.burst(s.x, s.y, 5, 150, 0.25, 1.5, [140, 220, 255])
        }
        break
      }
    }
    if(!p.alive) return
    for(i = 0; i < this.eshots.length; i++) {
      s = this.eshots[i]
      if(s.alive && p.dist(s) < p.r + s.r) {
        s.alive = false
        p.hurt(s.dmg)
        this.particles.burst(s.x, s.y, 8, 160, 0.3, 1.5, [255, 120, 80])
      }
    }
    for(i = 0; i < this.enemies.length; i++) {
      e = this.enemies[i]
      if(!e.alive) continue
      d = p.dist(e)
      if(d >= p.r + e.r) continue
      if(e.contact) {
        p.hurt(e.contact)
        e.hp = 0
        e.die()
      } else if(e.solid && d > 0.01) {
        // bounce off structures
        var nx = (p.x - e.x) / d, ny = (p.y - e.y) / d, push = p.r + e.r - d
        if(!this.level.circleHits(p.x + nx * push, p.y + ny * push, p.r)) {
          p.x += nx * push
          p.y += ny * push
        }
        var vn = p.vx * nx + p.vy * ny
        if(vn < 0) {
          p.vx -= 1.5 * vn * nx
          p.vy -= 1.5 * vn * ny
        }
      }
    }
    for(i = 0; i < this.pickups.length; i++) {
      var k = this.pickups[i]
      if(k.alive && p.dist(k) < p.r + k.r) this.collect(k)
    }
  },
  collect: function(k) {
    var p = this.player
    k.alive = false
    this.score += 50
    switch(k.kind) {
      case 'E':
        p.energy = Math.min(100, p.energy + 35)
        this.message('ENERGY +35', '#8dffa8')
        break
      case 'P':
        if(p.weapon < 4) {
          p.weapon++
          this.message('CANNON LEVEL ' + p.weapon, '#ffc27a')
        } else {
          this.score += 500
          this.message('BONUS 500', '#ffc27a')
        }
        break
      case 'M':
        p.missiles = Math.min(20, p.missiles + 4)
        this.message('MISSILES +4', '#9ad4ff')
        break
    }
    this.particles.burst(k.x, k.y, 16, 200, 0.4, 2, [255, 255, 200])
    Sfx.play('pickup')
  },
  shotHitWall: function(s) {
    var lv = this.level
    var tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS)
    s.alive = false
    if(s.friendly && lv.blockAt(tx, ty)) {
      if(lv.damageBlock(tx, ty, s.dmg)) {
        this.particles.explosion((tx + 0.5) * TS, (ty + 0.5) * TS, 0.8)
        this.score += 10
        Sfx.play('explode')
      } else {
        Sfx.play('block')
      }
    }
    if(s.missile) {
      this.particles.explosion(s.x, s.y, 0.5)
      Sfx.play('explode')
    } else {
      this.particles.burst(s.x - s.vx * 0.01, s.y - s.vy * 0.01, 4, 140, 0.2, 1.5, s.friendly ? [180, 230, 255] : [255, 140, 90])
    }
  },
  enemyShot: function(x, y, angle, speed, dmg) {
    this.eshots.push(new Shot(this, x, y, Math.sin(angle) * speed, -Math.cos(angle) * speed,
      { r: 4, dmg: dmg, life: 3, color: [255, 70, 50], friendly: false }))
    if(this.player.alive && this.player.dist({ x: x, y: y }) < 500) Sfx.play('enemyShoot')
  },
  enemyDestroyed: function(e) {
    this.score += e.score
    this.particles.explosion(e.x, e.y, e.boom)
    this.shake = Math.min(22, this.shake + 3 * e.boom)
    Sfx.play(e.boom > 1.5 ? 'bigExplode' : 'explode')
    if(e.boom > 2) {
      for(var i = 0; i < e.boom * 2; i++) {
        this.delayed.push({ t: 0.15 + i * 0.15, x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y + (Math.random() - 0.5) * e.r * 2, s: 0.8 + Math.random() })
      }
    }
    if(e.isTarget) {
      this.pickups.push(new Pickup(this, e.x, e.y, 'E', 0))
      this.checkpoint = { x: e.x, y: e.y }
      var left = this.targetsLeft()
      if(left > 0) {
        this.message((e instanceof Mothercore ? 'MOTHERCORE' : 'REACTOR CORE') + ' DESTROYED - ' + left + ' LEFT', '#ffd27a')
      } else {
        this.gate.active = true
        this.message('ALL TARGETS DESTROYED', '#ffd27a')
        this.message('RETURN TO THE WARP GATE', '#5affc8')
        Sfx.play('warp')
      }
    } else if(Math.random() < e.dropChance) {
      this.pickups.push(new Pickup(this, e.x, e.y, Math.random() < 0.6 ? 'E' : (Math.random() < 0.5 ? 'P' : 'M'), 12))
    }
    if(e instanceof Generator) {
      for(i = 0; i < e.protects.length; i++) {
        var t = e.protects[i]
        if(t.alive && !t.shielded()) {
          this.message(t instanceof Mothercore ? 'MOTHERCORE SHIELD DOWN' : 'CORE SHIELDS DOWN', '#7fe8ff')
          Sfx.play('shieldDown')
          break
        }
      }
      if(e.protects.length && i == e.protects.length) this.message('GENERATOR DESTROYED', '#7fe8ff')
    }
  },
  findMissileTarget: function(m) {
    var best = null, bestScore = 1e9
    for(var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i]
      if(!e.alive || e.shielded()) continue
      var d = m.dist(e)
      if(d > 600) continue
      var off = Math.abs(angleDiff(m.angle, m.angleTo(e)))
      if(off > 1.8) continue
      var score = d + off * 200
      if(score < bestScore) {
        bestScore = score
        best = e
      }
    }
    return best
  },
  updateCamera: function(dt, snap) {
    var p = this.player
    var dir = DIRS[p.heading]
    var tx = p.x + dir.x * 70 - this.W / 2, ty = p.y + dir.y * 50 - this.H / 2
    var k = snap ? 1 : Math.min(1, dt * 4)
    this.camX += (tx - this.camX) * k
    this.camY += (ty - this.camY) * k
    this.camX = Math.max(0, Math.min(this.level.w * TS - this.W, this.camX))
    this.camY = Math.max(0, Math.min(this.level.h * TS - this.H, this.camY))
    this.shake *= Math.max(0, 1 - dt * 6)
  },

  // ------------------------------------------------------------ render

  render: function() {
    var ctx = this.ctx
    switch(this.state) {
      case 'title':
        this.renderTitle(ctx)
        break
      case 'waiting':
        this.renderSpace(ctx, 20)
        this.text(ctx, 'WAITING FOR MISSION...', this.W / 2, this.H / 2, 24, '#9fb4c8', 'center')
        break
      case 'briefing':
        this.renderBriefing(ctx)
        break
      case 'play':
        this.renderWorld(ctx)
        this.renderHud(ctx)
        if(this.paused) this.renderOverlay(ctx, ['PAUSED', '', TouchPad.active ? 'TAP TO CONTINUE' : 'PRESS P TO CONTINUE'])
        break
      case 'complete':
        this.renderWorld(ctx)
        this.renderHud(ctx)
        this.renderComplete(ctx)
        break
      case 'gameover':
        this.renderWorld(ctx)
        this.renderHud(ctx)
        this.renderOverlay(ctx, ['GAME OVER', '', 'SCORE ' + this.score, '', this.stateTime > 1.5 ? this.prompt(this.custom == 'editor' ? 'TO TRY AGAIN' : '') : ''])
        break
      case 'victory':
        this.renderVictory(ctx)
        break
    }
    if(TouchPad.active && window.innerHeight > window.innerWidth) {
      this.renderOverlay(ctx, ['ROTATE DEVICE', '', 'LONE VECTOR PLAYS IN LANDSCAPE'])
    }
  },
  prompt: function(what) {
    return (TouchPad.active ? 'TAP' : 'PRESS ENTER') + (what ? ' ' + what : '')
  },
  renderWorld: function(ctx) {
    var W = this.W, H = this.H, i, e
    var sx = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0
    var sy = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0
    var cx = Math.round(this.camX + sx), cy = Math.round(this.camY + sy)
    var view = { x0: cx - 120, y0: cy - 120, x1: cx + W + 120, y1: cy + H + 120 }
    var inView = function(a) {
      return a.x > view.x0 && a.x < view.x1 && a.y > view.y0 && a.y < view.y1
    }
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    if(this.terrain.space) this.terrain.renderBackdrop(ctx, cx, cy, W, H)
    ctx.save()
    ctx.translate(-cx, -cy)
    this.terrain.render(ctx, cx, cy, W, H)
    this.renderBlocks(ctx, cx, cy)
    this.gate.render(ctx)
    for(i = 0; i < this.pickups.length; i++) if(inView(this.pickups[i])) this.pickups[i].render(ctx)
    for(i = 0; i < this.enemies.length; i++) {
      e = this.enemies[i]
      if(e instanceof Generator) e.renderBeams(ctx)
    }
    for(i = 0; i < this.enemies.length; i++) {
      e = this.enemies[i]
      if(e.layer == 0 && inView(e)) e.render(ctx)
    }
    for(i = 0; i < this.enemies.length; i++) {
      e = this.enemies[i]
      if(e.layer == 1 && inView(e)) e.render(ctx)
    }
    if(this.player.alive) this.player.render(ctx)
    for(i = 0; i < this.shots.length; i++) this.shots[i].render(ctx)
    for(i = 0; i < this.eshots.length; i++) if(inView(this.eshots[i])) this.eshots[i].render(ctx)
    this.particles.render(ctx, view)
    ctx.restore()
    ctx.drawImage(this.vignette, 0, 0)
  },
  renderBlocks: function(ctx, cx, cy) {
    var lv = this.level, spr = Gfx.sprites.block
    var tx0 = Math.max(0, Math.floor(cx / TS)), tx1 = Math.min(lv.w - 1, Math.floor((cx + this.W) / TS))
    var ty0 = Math.max(0, Math.floor(cy / TS)), ty1 = Math.min(lv.h - 1, Math.floor((cy + this.H) / TS))
    for(var ty = ty0; ty <= ty1; ty++) {
      for(var tx = tx0; tx <= tx1; tx++) {
        var b = lv.blocks[ty * lv.w + tx]
        if(!b) continue
        var x = tx * TS, y = ty * TS
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(x + 6, y + 6, TS, TS)
        ctx.drawImage(spr, x, y)
        if(b.hp < b.max) {
          ctx.strokeStyle = 'rgba(25,15,5,0.8)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          for(var k = 0; k < b.max - b.hp; k++) {
            var h1 = Noise.hash(tx * 7 + k, ty, 3), h2 = Noise.hash(tx, ty * 7 + k, 4)
            var mx = x + 8 + h1 * 16, my = y + 8 + h2 * 16
            ctx.moveTo(mx, my)
            ctx.lineTo(x + h2 * 32, y + (k % 2 ? 0 : 32))
            ctx.moveTo(mx, my)
            ctx.lineTo(x + (k % 2 ? 32 : 0), y + h1 * 32)
          }
          ctx.stroke()
        }
      }
    }
  },

  text: function(ctx, str, x, y, size, color, align) {
    ctx.font = 'bold ' + size + 'px "Courier New", Consolas, monospace'
    ctx.textAlign = align || 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(0,0,0,0.75)'
    ctx.fillText(str, x + 2, y + 2)
    ctx.fillStyle = color
    ctx.fillText(str, x, y)
  },
  pad: function(n, len) {
    var s = String(n)
    while(s.length < len) s = '0' + s
    return s
  },
  renderHud: function(ctx) {
    var W = this.W, H = this.H, p = this.player, i
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, W, 34)
    this.text(ctx, 'SCORE ' + this.pad(this.score, 7), 14, 23, 17, '#ffffff')
    this.text(ctx, 'HI ' + this.pad(Math.max(this.hiscore, this.score), 7), 250, 23, 17, '#9aa4b0')
    this.text(ctx, (this.custom ? 'CUSTOM' : 'MISSION ' + (this.levelIndex + 1)), W / 2 + 60, 23, 17, '#ffd27a', 'left')
    var left = this.targetsLeft()
    this.text(ctx, 'TARGETS ' + (this.targetsTotal - left) + '/' + this.targetsTotal, W - 14, 23, 17, left ? '#ffb070' : '#5affc8', 'right')

    // energy gauge (moved to the top on touch screens, away from the thumbs)
    var py = TouchPad.active ? 42 : H - 62
    var energy = Math.max(0, p.alive ? p.energy : 0)
    var low = energy < 25
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(10, py, 300, 52)
    this.text(ctx, 'ENERGY', 20, py + 20, 15, low && Math.floor(this.stateTime * 4) % 2 ? '#ff4030' : '#cfd8e0')
    var segs = 20
    for(i = 0; i < segs; i++) {
      var on = energy > i * 100 / segs
      var c = i < 5 ? '#ff4a30' : (i < 10 ? '#ffc040' : '#50ff90')
      ctx.fillStyle = on ? c : 'rgba(255,255,255,0.08)'
      ctx.fillRect(98 + i * 10.5, py + 7, 8, 14)
    }
    // weapons and lives
    this.text(ctx, 'GUN', 20, py + 44, 15, '#cfd8e0')
    for(i = 0; i < 4; i++) {
      ctx.fillStyle = i < p.weapon ? '#ffb050' : 'rgba(255,255,255,0.1)'
      ctx.fillRect(58 + i * 12, py + 33, 9, 11)
    }
    this.text(ctx, 'MSL ' + this.pad(p.missiles, 2), 122, py + 44, 15, '#9ad4ff')
    for(i = 0; i < Math.max(0, this.lives); i++) {
      ctx.save()
      ctx.translate(236 + i * 22, py + 38)
      ctx.scale(0.42, 0.42)
      ctx.drawImage(Gfx.sprites.ship, -24, -24)
      ctx.restore()
    }

    if(TouchPad.active) this.renderRadar(ctx, W - 80, 118, 72)
    else this.renderRadar(ctx, W - 96, H - 96, 84)
    if(this.gate.active) this.renderPointer(ctx, this.gate.x, this.gate.y, '#5affc8')
    TouchPad.render(ctx)

    for(i = 0; i < this.messages.length; i++) {
      var m = this.messages[i]
      ctx.globalAlpha = Math.min(1, m.t * 2)
      this.text(ctx, m.text, W / 2, 80 + i * 28, 20, m.color, 'center')
      ctx.globalAlpha = 1
    }
  },
  renderRadar: function(ctx, cx, cy, R) {
    var p = this.player, k = R / RADAR_RANGE, i, e, dx, dy, d
    ctx.save()
    ctx.fillStyle = 'rgba(0,24,14,0.65)'
    Gfx.circle(ctx, cx, cy, R)
    ctx.fill()
    ctx.clip()
    // installation footprints
    var insts = this.level.installations
    ctx.fillStyle = 'rgba(120,220,255,0.18)'
    for(i = 0; i < insts.length; i++) {
      var ins = insts[i]
      ctx.fillRect(cx + (ins.ox * TS - p.x) * k, cy + (ins.oy * TS - p.y) * k, ins.W * TS * k, ins.H * TS * k)
    }
    ctx.strokeStyle = 'rgba(90,255,160,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - R, cy)
    ctx.lineTo(cx + R, cy)
    ctx.moveTo(cx, cy - R)
    ctx.lineTo(cx, cy + R)
    ctx.stroke()
    Gfx.circle(ctx, cx, cy, R / 2)
    ctx.stroke()
    // sweep
    var sa = this.levelTime * 2.5
    ctx.strokeStyle = 'rgba(90,255,160,0.5)'
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R)
    ctx.stroke()
    for(i = 0; i < this.enemies.length; i++) {
      e = this.enemies[i]
      dx = (e.x - p.x) * k
      dy = (e.y - p.y) * k
      if(dx * dx + dy * dy > R * R) continue
      if(e.isTarget) ctx.fillStyle = e.shielded() ? '#6ac8ff' : (Math.floor(this.levelTime * 4) % 2 ? '#ffe060' : '#ff9a30')
      else if(e instanceof Generator) ctx.fillStyle = '#7fe8ff'
      else ctx.fillStyle = '#ff4a40'
      var s = e.isTarget ? 5 : (e.solid ? 3 : 2)
      ctx.fillRect(cx + dx - s / 2, cy + dy - s / 2, s, s)
    }
    ctx.restore()
    // discovered but out-of-range targets and the gate sit on the rim
    for(i = 0; i < this.enemies.length; i++) {
      e = this.enemies[i]
      if(!(e.isTarget || e instanceof Generator) || !e.discovered) continue
      dx = e.x - p.x
      dy = e.y - p.y
      d = Math.sqrt(dx * dx + dy * dy)
      if(d * k <= R) continue
      ctx.fillStyle = e.isTarget ? '#ffc040' : '#7fe8ff'
      ctx.fillRect(cx + dx / d * (R - 3) - 2, cy + dy / d * (R - 3) - 2, 4, 4)
    }
    if(this.gate.active) {
      dx = this.gate.x - p.x
      dy = this.gate.y - p.y
      d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      var gr = Math.min(R - 3, d * k)
      ctx.fillStyle = '#5affc8'
      ctx.fillRect(cx + dx / d * gr - 3, cy + dy / d * gr - 3, 6, 6)
    }
    ctx.strokeStyle = 'rgba(90,255,160,0.7)'
    ctx.lineWidth = 2
    Gfx.circle(ctx, cx, cy, R)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(p.heading * Math.PI / 4)
    Gfx.poly(ctx, [0, -5, 4, 4, -4, 4])
    ctx.fill()
    ctx.restore()
  },
  renderPointer: function(ctx, x, y, color) {
    var W = this.W, H = this.H
    var dx = x - (this.camX + W / 2), dy = y - (this.camY + H / 2)
    if(Math.abs(dx) < W / 2 - 30 && Math.abs(dy) < H / 2 - 30) return
    var a = Math.atan2(dy, dx)
    var t = Math.min((W / 2 - 50) / Math.abs(Math.cos(a) || 0.001), (H / 2 - 60) / Math.abs(Math.sin(a) || 0.001))
    ctx.save()
    ctx.translate(W / 2 + Math.cos(a) * t, H / 2 + Math.sin(a) * t)
    ctx.rotate(a)
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.stateTime * 8)
    ctx.fillStyle = color
    Gfx.poly(ctx, [16, 0, -8, -11, -3, 0, -8, 11])
    ctx.fill()
    ctx.restore()
  },
  renderOverlay: function(ctx, lines) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, this.W, this.H)
    var y = this.H / 2 - lines.length * 18
    for(var i = 0; i < lines.length; i++) {
      this.text(ctx, lines[i], this.W / 2, y + i * 36, i == 0 ? 44 : 22, i == 0 ? '#ffd27a' : '#ffffff', 'center')
    }
  },
  renderComplete: function(ctx) {
    var b = this.bonus, last = this.levelIndex + 1 >= this.missions.length
    var lines = [
      'SECTOR CLEARED',
      '',
      'ENERGY BONUS  ' + this.pad(b.energy, 6),
      'TIME BONUS    ' + this.pad(b.time, 6),
      '',
      'SCORE         ' + this.pad(this.score, 6),
      '',
      this.stateTime > 1.2 ? this.prompt(this.custom == 'editor' ? 'TO PLAY AGAIN' : (last ? '' : 'FOR NEXT MISSION')) : ''
    ]
    this.renderOverlay(ctx, lines)
  },
  renderSpace: function(ctx, speed) {
    var W = this.W, H = this.H, t = this.stateTime
    ctx.fillStyle = '#03040a'
    ctx.fillRect(0, 0, W, H)
    for(var i = 0; i < this.stars.length; i++) {
      var s = this.stars[i]
      var x = ((s.x - t * speed * s.z) % W + W) % W
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + s.z * 0.75) + ')'
      var sz = s.z > 0.8 ? 2 : 1
      ctx.fillRect(x, s.y, sz, sz)
    }
  },
  renderTitle: function(ctx) {
    var W = this.W, H = this.H, t = this.stateTime
    this.renderSpace(ctx, 20)
    ctx.drawImage(this.planet, W - 330, H - 300)
    // demo ship drifting across the planet
    var sx = W * 0.5 + Math.cos(t * 0.5) * 300, sy = H * 0.62 + Math.sin(t) * 70
    var a = Math.atan2(-Math.sin(t * 0.5) * 150, -Math.cos(t) * 70)
    Gfx.drawGlow(ctx, sx - Math.sin(a) * 19, sy + Math.cos(a) * 19, 12, [90, 160, 255], 0.9)
    Gfx.drawRot(ctx, Gfx.sprites.ship, sx, sy, a)

    ctx.save()
    ctx.font = 'bold 84px "Courier New", Consolas, monospace'
    ctx.textAlign = 'center'
    var grad = ctx.createLinearGradient(0, 90, 0, 170)
    grad.addColorStop(0, '#fff3c0')
    grad.addColorStop(0.5, '#ffb030')
    grad.addColorStop(1, '#c03a10')
    ctx.shadowColor = '#ff6a20'
    ctx.shadowBlur = 24
    ctx.fillStyle = grad
    ctx.fillText('LONE VECTOR', W / 2, 160)
    ctx.restore()
    this.text(ctx, 'FIVE SECTORS  -  ONE SHIP  -  NO RETURN', W / 2, 200, 18, '#9fb4c8', 'center')
    if(Math.floor(t * 2) % 2 == 0) this.text(ctx, this.prompt('TO LAUNCH'), W / 2, 280, 26, '#ffffff', 'center')
    this.text(ctx, 'HI-SCORE ' + this.pad(this.hiscore, 7), W / 2, 320, 18, '#ffd27a', 'center')

    var help = TouchPad.active ? [
      ['LEFT THUMB', 'joystick: turn & thrust'],
      ['FIRE', 'cannon'],
      ['MSL', 'homing missile'],
      ['HOLD / BRAKE', 'strafe / brake in space'],
      ['II', 'pause']
    ] : [
      ['ARROWS / WASD', 'turn & thrust (8 directions)'],
      ['SPACE / Z', 'cannon'],
      ['X', 'homing missile'],
      ['SHIFT', 'strafe / brake in space'],
      ['P   M', 'pause   sound on/off']
    ]
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(28, H - 190, 470, 168)
    this.text(ctx, 'CONTROLS', 44, H - 162, 16, '#ffb070')
    for(var i = 0; i < help.length; i++) {
      this.text(ctx, help[i][0], 44, H - 134 + i * 24, 15, '#ffffff')
      this.text(ctx, help[i][1], 210, H - 134 + i * 24, 15, '#9fb4c8')
    }
  },
  renderBriefing: function(ctx) {
    var W = this.W, H = this.H, t = this.stateTime, def = this.missions[this.levelIndex]
    this.renderSpace(ctx, 60)
    this.text(ctx, this.custom ? 'CUSTOM MISSION' : 'MISSION ' + (this.levelIndex + 1) + ' OF ' + this.missions.length, 60, 90, 20, '#9fb4c8')
    this.text(ctx, def.name, 60, 136, 44, '#ffd27a')
    this.text(ctx, def.place, 60, 168, 16, '#ffb070')
    // briefing typed out like a terminal
    var chars = Math.floor(t * 45)
    for(var i = 0; i < def.briefing.length; i++) {
      var line = def.briefing[i]
      if(chars <= 0) break
      this.text(ctx, line.substr(0, chars), 60, 230 + i * 28, 18, '#e0e8f0')
      chars -= line.length
    }
    var objectives = []
    var cores = 0, boss = 0, gens = 0
    for(i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i]
      if(e instanceof Core) cores++
      if(e instanceof Mothercore) boss++
      if(e instanceof Generator) gens++
    }
    objectives.push('DESTROY ' + cores + ' REACTOR CORES')
    if(gens) objectives.push(gens + ' SHIELD GENERATORS DETECTED')
    if(boss) objectives.push('DESTROY THE MOTHERCORE')
    for(i = 0; i < objectives.length; i++) this.text(ctx, '> ' + objectives[i], 60, 400 + i * 26, 17, '#5affc8')

    // orbital scan: thumbnails of the terrain chunks as they get generated
    var size = 260, mx = W - size - 60, my = 80
    ctx.fillStyle = 'rgba(0,30,20,0.6)'
    ctx.fillRect(mx - 6, my - 6, size + 12, size + 12)
    var tr = this.terrain, cs = size / Math.max(tr.cols, tr.rows)
    for(var key in tr.chunks) {
      var pos = key.split(',')
      ctx.drawImage(tr.chunks[key], mx + pos[0] * cs, my + pos[1] * cs, cs, cs)
    }
    ctx.strokeStyle = 'rgba(90,255,160,0.7)'
    ctx.lineWidth = 2
    ctx.strokeRect(mx - 6, my - 6, size + 12, size + 12)
    var prog = tr.progress()
    this.text(ctx, prog < 1 ? 'ORBITAL SCAN ' + Math.floor(prog * 100) + '%' : 'SCAN COMPLETE', mx, my + size + 34, 16, '#5affc8')
    if(prog >= 1) {
      var lz = this.level.spawn, k = cs / CHUNK
      if(Math.floor(t * 3) % 2) {
        ctx.strokeStyle = '#5affc8'
        Gfx.circle(ctx, mx + lz.x * k, my + lz.y * k, 6)
        ctx.stroke()
      }
      this.text(ctx, 'LANDING ZONE', mx, my + size + 58, 14, '#9fb4c8')
      if(t > 0.8 && Math.floor(t * 2) % 2 == 0) this.text(ctx, this.prompt('TO LAUNCH'), W / 2, H - 50, 24, '#ffffff', 'center')
    }
  },
  renderVictory: function(ctx) {
    var W = this.W, H = this.H
    this.renderSpace(ctx, 10)
    ctx.drawImage(this.planet, W / 2 - 160, H - 230)
    this.particles.render(ctx)
    this.text(ctx, 'MISSION ACCOMPLISHED', W / 2, 150, 48, '#ffd27a', 'center')
    this.text(ctx, 'The Citadel has fallen. The war is over.', W / 2, 200, 18, '#e0e8f0', 'center')
    this.text(ctx, 'FINAL SCORE ' + this.pad(this.score, 7), W / 2, 260, 26, '#ffffff', 'center')
    this.text(ctx, 'HI-SCORE ' + this.pad(this.hiscore, 7), W / 2, 295, 18, '#9fb4c8', 'center')
    if(this.stateTime > 2 && Math.floor(this.stateTime * 2) % 2 == 0) this.text(ctx, this.prompt(''), W / 2, 345, 22, '#ffffff', 'center')
  }
})
