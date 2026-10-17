// Game actors. Angles: 0 = up (north), clockwise, radians.

var DIRS = []
for(var di = 0; di < 8; di++) DIRS.push({ x: Math.sin(di * Math.PI / 4), y: -Math.cos(di * Math.PI / 4) })

var angleDiff = function(a, b) {
  var d = (b - a) % (Math.PI * 2)
  if(d > Math.PI) d -= Math.PI * 2
  if(d < -Math.PI) d += Math.PI * 2
  return d
}

var Actor = Base.extend({
  constructor: function(game, x, y) {
    this.game = game
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.r = 10
    this.hp = 1
    this.alive = true
    this.age = 0
    this.flash = 0
  },
  update: function(dt) {
    this.age += dt
    if(this.flash > 0) this.flash -= dt
  },
  render: function(ctx) {
  },
  dist: function(o) {
    var dx = o.x - this.x, dy = o.y - this.y
    return Math.sqrt(dx * dx + dy * dy)
  },
  angleTo: function(o) {
    return Math.atan2(o.x - this.x, this.y - o.y)
  },
  // axis separated movement so actors slide along walls
  moveCollide: function(dt) {
    var lv = this.game.level, hit = { x: false, y: false }
    var nx = this.x + this.vx * dt
    if(lv.circleHits(nx, this.y, this.r)) hit.x = true
    else this.x = nx
    var ny = this.y + this.vy * dt
    if(lv.circleHits(this.x, ny, this.r)) hit.y = true
    else this.y = ny
    return hit
  },
  shadow: function(ctx, name, angle, ox, oy) {
    // nothing to cast a shadow on in space
    if(this.game.level.def.theme.space) return
    Gfx.drawRot(ctx, Gfx.tinted(name, '#000'), this.x + (ox || 10), this.y + (oy || 14), angle, 0.3)
  }
})

// ---------------------------------------------------------------- player

var Player = Actor.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 13
    this.heading = 0
    this.viewAngle = 0
    this.turnTimer = 0
    this.energy = 100
    this.weapon = 1
    this.missiles = 5
    this.fireTimer = 0
    this.missileTimer = 0
    this.bumpTimer = 0
    this.invuln = 2
    this.thrusting = false
    this.braking = false
    this.flame = 0
    this.speed = 160
  },
  update: function(dt) {
    this.base(dt)
    var g = this.game
    var ix = ((input.isDown('RIGHT') || input.isDown('d')) ? 1 : 0) - ((input.isDown('LEFT') || input.isDown('a')) ? 1 : 0)
    var iy = ((input.isDown('DOWN') || input.isDown('s')) ? 1 : 0) - ((input.isDown('UP') || input.isDown('w')) ? 1 : 0)
    var space = g.level.def.theme.space
    // SHIFT holds the heading (strafe) on planets, brakes in space
    var lock = input.isDown('SHIFT') && !space
    this.thrusting = !!(ix || iy)

    if(this.thrusting) {
      // the ship rotates through the 8 headings towards the stick direction
      var want = Math.round(Math.atan2(ix, -iy) / (Math.PI / 4)) & 7
      this.turnTimer -= dt
      if(!lock && want != this.heading && this.turnTimer <= 0) {
        var diff = (want - this.heading + 8) % 8
        this.heading = (this.heading + (diff <= 4 ? 1 : 7)) % 8
        this.turnTimer = 0.05
      }
    } else {
      this.turnTimer = 0
    }
    if(space) {
      // no ground to stop on: the engines always push the ship along its heading
      this.braking = input.isDown('SHIFT')
      var target = this.braking ? 85 : (this.thrusting ? 270 : 160)
      this.speed += Math.max(-320 * dt, Math.min(320 * dt, target - this.speed))
      var hd = DIRS[this.heading]
      var ks = Math.min(1, 2.8 * dt)
      this.vx += (hd.x * this.speed - this.vx) * ks
      this.vy += (hd.y * this.speed - this.vy) * ks
    } else if(this.thrusting) {
      var dir = lock ? DIRS[want] : DIRS[this.heading]
      var k = Math.min(1, 3.5 * dt)
      this.vx += (dir.x * 235 - this.vx) * k
      this.vy += (dir.y * 235 - this.vy) * k
    } else {
      var drag = Math.max(0, 1 - 2.5 * dt)
      this.vx *= drag
      this.vy *= drag
    }
    this.viewAngle += angleDiff(this.viewAngle, this.heading * Math.PI / 4) * Math.min(1, dt * 22)

    var hit = this.moveCollide(dt)
    if(this.bumpTimer > 0) this.bumpTimer -= dt
    if(hit.x || hit.y) {
      var impact = Math.max(hit.x ? Math.abs(this.vx) : 0, hit.y ? Math.abs(this.vy) : 0)
      if(hit.x) this.vx = -this.vx * (space ? 0.7 : 0.4)
      if(hit.y) this.vy = -this.vy * (space ? 0.7 : 0.4)
      if(space && this.vx * this.vx + this.vy * this.vy > 400) {
        // with the engines always on, ricochet: point the ship along the bounce
        this.heading = Math.round(Math.atan2(this.vx, -this.vy) / (Math.PI / 4)) & 7
      }
      if(impact > 140 && this.bumpTimer <= 0) {
        // crashing into walls costs energy, as in the original
        this.energy -= 2
        this.bumpTimer = 0.35
        g.shake = Math.min(12, g.shake + 4)
        g.particles.burst(this.x, this.y, 8, 160, 0.3, 1.5, [255, 220, 150])
        Sfx.play('bump')
      }
    }

    // energy is fuel and shield in one: it drains constantly
    this.energy -= g.level.def.drain * dt

    if(this.fireTimer > 0) this.fireTimer -= dt
    if(this.missileTimer > 0) this.missileTimer -= dt
    if((input.isDown('SPACE') || input.isDown('z') || input.isDown('j')) && this.fireTimer <= 0) this.fire()
    if((input.isDown('x') || input.isDown('k')) && this.missileTimer <= 0 && this.missiles > 0) this.fireMissile()
    if(this.invuln > 0) this.invuln -= dt

    this.flame = space ? (this.braking ? 0.4 : (this.thrusting ? 1.3 : 0.8)) : (this.thrusting ? 1 : 0)
    if(this.flame > 0.5 && Math.random() < 0.6 * this.flame) {
      var a = this.viewAngle
      var p = g.particles.add('glow', this.x - Math.sin(a) * 18, this.y + Math.cos(a) * 18,
        -Math.sin(a) * 120 + (Math.random() - 0.5) * 30, Math.cos(a) * 120 + (Math.random() - 0.5) * 30, 0.18, 5, [120, 190, 255])
      if(p) p.grow = -15
    }
    if(this.energy <= 0) g.playerDied()
  },
  nose: function(off, dist) {
    var a = this.heading * Math.PI / 4
    var fx = Math.sin(a), fy = -Math.cos(a)
    return { x: this.x + fx * dist - fy * off, y: this.y + fy * dist + fx * off }
  },
  fire: function() {
    var g = this.game, self = this, a = this.heading * Math.PI / 4
    var bullet = function(off, da) {
      var pos = self.nose(off, 16), aa = a + da
      g.shots.push(new Shot(g, pos.x, pos.y,
        Math.sin(aa) * 640 + self.vx * 0.3, -Math.cos(aa) * 640 + self.vy * 0.3,
        { r: 3, dmg: 1, life: 0.75, color: [120, 230, 255], friendly: true }))
    }
    switch(this.weapon) {
      case 1:
        bullet(0, 0)
        this.fireTimer = 0.17
        break
      case 2:
        bullet(-5, 0)
        bullet(5, 0)
        this.fireTimer = 0.15
        break
      case 3:
        bullet(0, 0)
        bullet(-5, -0.17)
        bullet(5, 0.17)
        this.fireTimer = 0.14
        break
      default:
        bullet(-4, 0)
        bullet(4, 0)
        bullet(-6, -0.22)
        bullet(6, 0.22)
        this.fireTimer = 0.13
    }
    var n = this.nose(0, 18)
    g.particles.add('glow', n.x, n.y, this.vx, this.vy, 0.06, 12, [150, 230, 255])
    Sfx.play('shoot')
  },
  fireMissile: function() {
    var n = this.nose(0, 14)
    this.missiles--
    this.missileTimer = 0.45
    this.game.shots.push(new Missile(this.game, n.x, n.y, this.heading * Math.PI / 4))
    Sfx.play('missile')
  },
  hurt: function(amount) {
    if(this.invuln > 0 || !this.alive) return
    this.energy -= amount
    this.flash = 0.12
    this.game.shake = Math.min(16, this.game.shake + amount * 0.6)
    Sfx.play('hit')
  },
  render: function(ctx) {
    var a = this.viewAngle
    this.shadow(ctx, 'ship', a, 14, 20)
    if(this.invuln > 0 && Math.floor(this.age * 16) % 2 == 0) return
    if(this.flame > 0) {
      var fl = (0.7 + Math.random() * 0.5) * this.flame
      Gfx.drawGlow(ctx, this.x - Math.sin(a) * 19, this.y + Math.cos(a) * 19, 11 * fl, [90, 160, 255], 0.9)
    }
    Gfx.drawRot(ctx, Gfx.sprites.ship, this.x, this.y, a)
    if(this.flash > 0) Gfx.drawRot(ctx, Gfx.tinted('ship', '#ff6040'), this.x, this.y, a, 0.8)
  }
})

// ---------------------------------------------------------------- projectiles

var Shot = Actor.extend({
  constructor: function(game, x, y, vx, vy, opts) {
    this.base(game, x, y)
    this.vx = vx
    this.vy = vy
    this.r = opts.r
    this.dmg = opts.dmg
    this.life = opts.life
    this.color = opts.color
    this.friendly = opts.friendly
  },
  update: function(dt) {
    this.base(dt)
    this.x += this.vx * dt
    this.y += this.vy * dt
    if(this.age > this.life) this.alive = false
    else if(this.game.level.solidAt(this.x, this.y)) this.game.shotHitWall(this)
  },
  render: function(ctx) {
    if(this.friendly) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = 'rgba(140,230,255,0.8)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(this.x, this.y)
      ctx.lineTo(this.x - this.vx * 0.022, this.y - this.vy * 0.022)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      Gfx.drawGlow(ctx, this.x, this.y, 8, this.color, 0.9)
    } else {
      Gfx.drawGlow(ctx, this.x, this.y, 11 + Math.sin(this.age * 30) * 2, this.color, 1)
    }
  }
})

var Missile = Shot.extend({
  constructor: function(game, x, y, angle) {
    this.base(game, x, y, Math.sin(angle) * 260, -Math.cos(angle) * 260,
      { r: 4, dmg: 6, life: 2.6, color: [255, 200, 120], friendly: true })
    this.angle = angle
    this.speed = 260
    this.target = null
    this.seek = 0
    this.missile = true
  },
  update: function(dt) {
    var g = this.game
    this.seek -= dt
    if(this.seek <= 0) {
      this.seek = 0.2
      this.target = g.findMissileTarget(this)
    }
    if(this.target && this.target.alive) {
      var d = angleDiff(this.angle, this.angleTo(this.target))
      this.angle += Math.max(-5 * dt, Math.min(5 * dt, d))
    }
    this.speed = Math.min(520, this.speed + 500 * dt)
    this.vx = Math.sin(this.angle) * this.speed
    this.vy = -Math.cos(this.angle) * this.speed
    var p = g.particles.add('smoke', this.x, this.y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.5, 2, [120, 115, 110])
    if(p) p.grow = 10
    this.base(dt)
  },
  render: function(ctx) {
    Gfx.drawGlow(ctx, this.x - Math.sin(this.angle) * 6, this.y + Math.cos(this.angle) * 6, 9, [255, 150, 60], 0.9)
    Gfx.drawRot(ctx, Gfx.sprites.missile, this.x, this.y, this.angle)
  }
})

// ---------------------------------------------------------------- enemies

var Enemy = Actor.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.score = 100
    this.contact = 0       // damage when ramming the player (then it blows up)
    this.solid = false     // player bounces off
    this.layer = 0         // 0 = ground structure, 1 = flying
    this.isTarget = false  // mission objective
    this.boom = 1          // explosion scale
    this.dropChance = 0.15
    this.inst = -1
  },
  shielded: function() {
    return false
  },
  // returns false when the hit was deflected
  hit: function(dmg) {
    if(this.shielded()) {
      Sfx.play('ping')
      return false
    }
    this.hp -= dmg
    this.flash = 0.07
    if(this.hp <= 0 && this.alive) this.die()
    return true
  },
  die: function() {
    this.alive = false
    this.game.enemyDestroyed(this)
  },
  playerInfo: function() {
    var p = this.game.player
    return p.alive ? { p: p, d: this.dist(p), a: this.angleTo(p) } : null
  },
  shoot: function(angle, speed, dmg) {
    this.game.enemyShot(this.x + Math.sin(angle) * (this.r + 4), this.y - Math.cos(angle) * (this.r + 4), angle, speed, dmg)
  },
  wander: function(dt, speed) {
    this.wanderAngle = (this.wanderAngle || Math.random() * 6.3) + (Math.random() - 0.5) * 4 * dt
    this.steer(Math.sin(this.wanderAngle) * speed, -Math.cos(this.wanderAngle) * speed, dt, 2)
  },
  steer: function(tx, ty, dt, rate) {
    var k = Math.min(1, rate * dt)
    this.vx += (tx - this.vx) * k
    this.vy += (ty - this.vy) * k
  },
  bounce: function(hit) {
    if(hit.x) this.vx = -this.vx * 0.6
    if(hit.y) this.vy = -this.vy * 0.6
    if(hit.x || hit.y) this.wanderAngle = Math.atan2(this.vx, -this.vy)
  },
  drawBody: function(ctx, name, angle) {
    Gfx.drawRot(ctx, Gfx.sprites[name], this.x, this.y, angle)
    if(this.flash > 0) Gfx.drawRot(ctx, Gfx.tinted(name, '#fff'), this.x, this.y, angle, 0.85)
  }
})

var Drone = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 12
    this.hp = 2
    this.score = 100
    this.contact = 14
    this.layer = 1
    this.speed = 115 + Math.random() * 35
    this.spin = Math.random() * 6
  },
  update: function(dt) {
    this.base(dt)
    this.spin += dt * 5
    var pi = this.playerInfo()
    if(pi && pi.d < 430) this.steer(Math.sin(pi.a) * this.speed, -Math.cos(pi.a) * this.speed, dt, 2.5)
    else this.wander(dt, this.speed * 0.4)
    this.bounce(this.moveCollide(dt))
  },
  render: function(ctx) {
    this.shadow(ctx, 'drone', this.spin)
    this.drawBody(ctx, 'drone', this.spin)
    Gfx.drawGlow(ctx, this.x, this.y, 7 + Math.sin(this.age * 8) * 2, [255, 50, 30], 1)
  }
})

var Fighter = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 14
    this.hp = 4
    this.score = 200
    this.contact = 18
    this.layer = 1
    this.angle = Math.random() * 6.3
    this.fireTimer = 1 + Math.random()
    this.orbit = Math.random() < 0.5 ? 1 : -1
    this.dropChance = 0.25
  },
  update: function(dt) {
    this.base(dt)
    var pi = this.playerInfo()
    if(pi && pi.d < 540) {
      var a = pi.a
      if(pi.d > 230) a = pi.a
      else if(pi.d > 140) a = pi.a + this.orbit * Math.PI / 2
      else a = pi.a + this.orbit * Math.PI * 0.75
      this.steer(Math.sin(a) * 180, -Math.cos(a) * 180, dt, 2)
      this.fireTimer -= dt
      if(this.fireTimer <= 0 && pi.d < 400 && this.game.level.lineClear(this.x, this.y, pi.p.x, pi.p.y)) {
        this.shoot(pi.a, 270, 10)
        this.fireTimer = 1.4 + Math.random() * 0.8
      }
    } else {
      this.wander(dt, 90)
    }
    if(this.vx * this.vx + this.vy * this.vy > 100) {
      this.angle += angleDiff(this.angle, Math.atan2(this.vx, -this.vy)) * Math.min(1, dt * 6)
    }
    this.bounce(this.moveCollide(dt))
  },
  render: function(ctx) {
    this.shadow(ctx, 'fighter', this.angle)
    Gfx.drawGlow(ctx, this.x - Math.sin(this.angle) * 15, this.y + Math.cos(this.angle) * 15, 7, [255, 80, 160], 0.8)
    this.drawBody(ctx, 'fighter', this.angle)
  }
})

var Turret = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 15
    this.hp = 6
    this.score = 250
    this.solid = true
    this.aim = Math.random() * 6.3
    this.fireTimer = 1 + Math.random()
    this.burst = 0
    this.burstTimer = 0
    this.dropChance = 0.2
  },
  update: function(dt) {
    this.base(dt)
    var pi = this.playerInfo()
    this.fireTimer -= dt
    if(pi && pi.d < 440 && this.game.level.lineClear(this.x, this.y, pi.p.x, pi.p.y)) {
      var d = angleDiff(this.aim, pi.a)
      this.aim += Math.max(-2.4 * dt, Math.min(2.4 * dt, d))
      if(Math.abs(d) < 0.12 && this.fireTimer <= 0) {
        this.burst = this.game.level.def.turretBurst
        this.fireTimer = 1.6
      }
    } else {
      this.aim += dt * 0.3
    }
    this.burstTimer -= dt
    if(this.burst > 0 && this.burstTimer <= 0) {
      this.shoot(this.aim, 250, 9)
      this.burst--
      this.burstTimer = 0.14
    }
  },
  render: function(ctx) {
    this.drawBody(ctx, 'turretBase', 0)
    Gfx.drawRot(ctx, Gfx.tinted('turretGun', '#000'), this.x + 4, this.y + 6, this.aim, 0.35)
    this.drawBody(ctx, 'turretGun', this.aim)
    Gfx.drawGlow(ctx, this.x, this.y, 4, [255, 80, 50], 0.9)
  }
})

var Mine = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 10
    this.hp = 1
    this.score = 50
    this.armed = false
    this.timer = 0
    this.dropChance = 0.05
  },
  update: function(dt) {
    this.base(dt)
    var pi = this.playerInfo()
    if(!this.armed && pi && pi.d < 75) {
      this.armed = true
      this.timer = 0.55
      Sfx.play('arm')
    }
    if(this.armed) {
      this.timer -= dt
      if(this.timer <= 0 && this.alive) {
        this.hp = 0
        this.die()
      }
    }
  },
  die: function() {
    this.base()
    var p = this.game.player
    if(p.alive && this.dist(p) < 95) p.hurt(26)
  },
  render: function(ctx) {
    this.drawBody(ctx, 'mine', this.age * 0.5)
    var blink = this.armed ? Math.floor(this.age * 16) % 2 : (Math.floor(this.age * 2) % 2)
    Gfx.drawGlow(ctx, this.x, this.y, blink ? 9 : 4, this.armed ? [255, 60, 30] : [255, 200, 60], 1)
  }
})

var Spawner = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 24
    this.hp = 14
    this.score = 500
    this.solid = true
    this.timer = 2
    this.children = []
    this.boom = 1.5
  },
  update: function(dt) {
    this.base(dt)
    this.timer -= dt
    if(this.timer <= 0) {
      this.timer = 4.5
      var live = []
      for(var i = 0; i < this.children.length; i++) if(this.children[i].alive) live.push(this.children[i])
      this.children = live
      var pi = this.playerInfo()
      if(pi && pi.d < 650 && live.length < 3) {
        var d = new Drone(this.game, this.x, this.y)
        this.children.push(d)
        this.game.enemies.push(d)
        this.game.particles.burst(this.x, this.y, 14, 160, 0.4, 2, [200, 120, 255])
        if(pi.d < 500) Sfx.play('spawn')
      }
    }
  },
  render: function(ctx) {
    this.drawBody(ctx, 'spawner', 0)
    var charge = 1 - Math.max(0, this.timer) / 4.5
    Gfx.drawGlow(ctx, this.x, this.y, 8 + charge * 12, [190, 90, 255], 0.5 + charge * 0.5)
  }
})

var Generator = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 18
    this.hp = 16
    this.score = 500
    this.solid = true
    this.boom = 1.6
    this.protects = []
    this.dropChance = 0.5
  },
  renderBeams: function(ctx) {
    for(var i = 0; i < this.protects.length; i++) {
      var t = this.protects[i]
      if(!t.alive) continue
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.setLineDash([14, 10])
      ctx.lineDashOffset = -this.age * 80
      ctx.strokeStyle = 'rgba(70,170,255,0.35)'
      ctx.lineWidth = 4 + Math.sin(this.age * 7)
      ctx.beginPath()
      ctx.moveTo(this.x, this.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(200,240,255,0.55)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }
  },
  render: function(ctx) {
    this.drawBody(ctx, 'generator', this.age * 0.4)
    Gfx.drawGlow(ctx, this.x, this.y, 12 + Math.sin(this.age * 9) * 3, [80, 200, 255], 0.9)
    // crackling arcs between the coils
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(170,235,255,0.8)'
    ctx.lineWidth = 1.2
    for(var k = 0; k < 2; k++) {
      var a = this.age * 0.4 + Math.floor(Math.random() * 4) * Math.PI / 2 + Math.PI / 4
      ctx.beginPath()
      ctx.moveTo(this.x, this.y)
      for(var s = 1; s <= 4; s++) {
        var rr = s * 3
        ctx.lineTo(this.x + Math.cos(a) * rr + (Math.random() - 0.5) * 5, this.y + Math.sin(a) * rr + (Math.random() - 0.5) * 5)
      }
      ctx.stroke()
    }
    ctx.restore()
  }
})

var Core = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 27
    this.hp = this.maxHp = 30
    this.score = 1000
    this.solid = true
    this.isTarget = true
    this.boom = 2.4
    this.shieldedBy = []
    this.dropChance = 0
  },
  shielded: function() {
    for(var i = 0; i < this.shieldedBy.length; i++) if(this.shieldedBy[i].alive) return true
    return false
  },
  render: function(ctx) {
    this.drawBody(ctx, 'core', 0)
    var pulse = 0.5 + 0.5 * Math.sin(this.age * (4 + 6 * (1 - this.hp / this.maxHp)))
    Gfx.drawGlow(ctx, this.x, this.y, 22 + pulse * 8, [255, 160, 50], 0.95)
    Gfx.drawGlow(ctx, this.x, this.y, 9 + pulse * 3, [255, 240, 200], 1)
    if(this.shielded()) Gfx.drawShield(ctx, this.x, this.y, 40, this.age)
  }
})

var Mothercore = Enemy.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 48
    this.hp = this.maxHp = 150
    this.score = 5000
    this.solid = true
    this.isTarget = true
    this.boom = 4
    this.shieldedBy = []
    this.spin = 0
    this.spiralTimer = 0
    this.ringTimer = 2
    this.aimTimer = 1
    this.dropChance = 0
  },
  shielded: function() {
    return Core.prototype.shielded.call(this)
  },
  update: function(dt) {
    this.base(dt)
    var sh = this.shielded()
    var rage = 1 + (1 - this.hp / this.maxHp)
    this.spin += dt * (sh ? 0.6 : 1.3 * rage)
    var pi = this.playerInfo()
    if(!pi || pi.d > 560) return
    this.spiralTimer -= dt
    if(this.spiralTimer <= 0) {
      this.shoot(this.spin * 2, 190, 8)
      this.shoot(this.spin * 2 + Math.PI, 190, 8)
      this.spiralTimer = sh ? 0.28 : 0.16 / rage
    }
    this.ringTimer -= dt
    if(this.ringTimer <= 0) {
      for(var i = 0; i < 16; i++) this.shoot(i * Math.PI / 8 + this.spin, 150, 8)
      this.ringTimer = 3.2
    }
    this.aimTimer -= dt
    if(this.aimTimer <= 0 && !sh) {
      this.shoot(pi.a - 0.15, 260, 9)
      this.shoot(pi.a, 260, 9)
      this.shoot(pi.a + 0.15, 260, 9)
      this.aimTimer = 1.3
    }
  },
  render: function(ctx) {
    this.drawBody(ctx, 'boss', this.age * 0.1)
    var sh = this.shielded()
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineWidth = 6
    for(var i = 0; i < 6; i++) {
      var a = this.spin + i * Math.PI / 3
      ctx.strokeStyle = sh ? 'rgba(90,180,255,0.7)' : 'rgba(255,70,90,0.85)'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 26, a, a + 0.6)
      ctx.stroke()
    }
    ctx.restore()
    var pi = this.playerInfo()
    var ex = pi ? Math.sin(pi.a) * 7 : 0, ey = pi ? -Math.cos(pi.a) * 7 : 0
    Gfx.drawGlow(ctx, this.x + ex, this.y + ey, 16 + Math.sin(this.age * 5) * 3, [255, 40, 70], 1)
    if(sh) Gfx.drawShield(ctx, this.x, this.y, 66, this.age)
  }
})

// ---------------------------------------------------------------- misc

var Pickup = Actor.extend({
  constructor: function(game, x, y, kind, ttl) {
    this.base(game, x, y)
    this.kind = kind
    this.ttl = ttl || 0
    this.r = 14
  },
  update: function(dt) {
    this.base(dt)
    if(this.ttl && this.age > this.ttl) this.alive = false
    var p = this.game.player
    if(p.alive && this.dist(p) < 80) {
      var a = this.angleTo(p)
      this.x += Math.sin(a) * 140 * dt
      this.y -= Math.cos(a) * 140 * dt
    }
  },
  render: function(ctx) {
    if(this.ttl && this.ttl - this.age < 3 && Math.floor(this.age * 10) % 2) return
    var colors = { E: [80, 255, 120], P: [255, 160, 60], M: [90, 170, 255] }
    var y = this.y + Math.sin(this.age * 4) * 2
    Gfx.drawGlow(ctx, this.x, y, 22, colors[this.kind], 0.45)
    Gfx.drawRot(ctx, Gfx.sprites['pickup' + this.kind], this.x, y, 0)
  }
})

var WarpGate = Actor.extend({
  constructor: function(game, x, y) {
    this.base(game, x, y)
    this.r = 28
    this.active = false
  },
  render: function(ctx) {
    var t = this.age
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    Gfx.circle(ctx, 5, 6, 34)
    ctx.fill()
    ctx.fillStyle = '#1d232b'
    Gfx.circle(ctx, 0, 0, 34)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#56606c'
    ctx.stroke()
    for(var i = 0; i < 8; i++) {
      ctx.save()
      ctx.rotate(i * Math.PI / 4 + (this.active ? t * 0.8 : 0))
      ctx.fillStyle = this.active ? '#5affc8' : '#3b4450'
      Gfx.poly(ctx, [-4, -31, 4, -31, 0, -25])
      ctx.fill()
      ctx.restore()
    }
    if(this.active) {
      ctx.globalCompositeOperation = 'lighter'
      for(i = 0; i < 3; i++) {
        var a = t * (i % 2 ? 2.2 : -3) + i
        ctx.strokeStyle = 'rgba(90,255,200,' + (0.7 - i * 0.18) + ')'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, 9 + i * 6 + Math.sin(t * 4 + i) * 1.5, a, a + 4.2)
        ctx.stroke()
      }
    }
    ctx.restore()
    if(this.active) Gfx.drawGlow(ctx, this.x, this.y, 20 + Math.sin(t * 6) * 4, [90, 255, 200], 0.8)
  }
})
