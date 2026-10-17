// On-screen controls for touch devices: a floating joystick on the left half,
// action buttons on the right. Everything is translated into virtual key presses,
// so the game logic is identical for keyboard and touch.

var TouchPad = {
  active: false,
  game: null,
  canvas: null,
  stick: null,
  held: {},

  init: function(canvas, game) {
    this.canvas = canvas
    this.game = game
    var self = this
    var opts = { passive: false }
    canvas.addEventListener('touchstart', function(e) { self.start(e) }, opts)
    canvas.addEventListener('touchmove', function(e) { self.move(e) }, opts)
    canvas.addEventListener('touchend', function(e) { self.end(e) }, opts)
    canvas.addEventListener('touchcancel', function(e) { self.end(e) }, opts)
  },
  space: function() {
    var g = this.game
    return !!(g.level && g.level.def.theme.space)
  },
  buttons: function() {
    var W = this.game.W, H = this.game.H
    return [
      { key: 'SPACE', label: 'FIRE', x: W - 120, y: H - 130, r: 62 },
      { key: 'X', label: 'MSL', x: W - 258, y: H - 72, r: 42 },
      { key: 'SHIFT', label: this.space() ? 'BRAKE' : 'HOLD', x: W - 84, y: H - 272, r: 40 }
    ]
  },
  pauseButton: function() {
    return { x: this.game.W / 2, y: 17, r: 24 }
  },
  stickHome: function() {
    return { x: 150, y: this.game.H - 150 }
  },
  toCanvas: function(t) {
    var rect = this.canvas.getBoundingClientRect()
    return {
      x: (t.clientX - rect.left) * this.canvas.width / rect.width,
      y: (t.clientY - rect.top) * this.canvas.height / rect.height
    }
  },
  tap: function(key) {
    input.set(key, true)
    input.set(key, false)
  },
  fullscreen: function() {
    var el = document.documentElement
    try {
      var p = el.requestFullscreen ? el.requestFullscreen() : (el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null)
      if(p && p.then) {
        p.then(function() {
          if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function() {})
        }).catch(function() {})
      }
    } catch(e) {
    }
  },

  start: function(e) {
    e.preventDefault()
    Sfx.init()
    if(!this.active) {
      this.active = true
      this.fullscreen()
    }
    var g = this.game
    for(var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i], p = this.toCanvas(t)
      if(g.state != 'play') {
        this.tap('ENTER')
        continue
      }
      var pb = this.pauseButton()
      if(g.paused || Math.hypot(p.x - pb.x, p.y - pb.y) < pb.r + 12) {
        this.tap('P')
        continue
      }
      if(p.x < g.W * 0.45 && !this.stick) {
        this.stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y }
        continue
      }
      var bs = this.buttons(), best = null, bestD = 1e9
      for(var k = 0; k < bs.length; k++) {
        var d = Math.hypot(p.x - bs[k].x, p.y - bs[k].y)
        if(d < bs[k].r + 30 && d < bestD) {
          best = bs[k]
          bestD = d
        }
      }
      if(best) {
        this.held[t.identifier] = best.key
        input.set(best.key, true)
      }
    }
  },
  move: function(e) {
    e.preventDefault()
    for(var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]
      if(!this.stick || t.identifier != this.stick.id) continue
      var p = this.toCanvas(t), s = this.stick
      s.x = p.x
      s.y = p.y
      // the stick base follows the thumb when it drifts too far
      var dx = s.x - s.ox, dy = s.y - s.oy, d = Math.sqrt(dx * dx + dy * dy), R = 70
      if(d > R) {
        s.ox = s.x - dx / d * R
        s.oy = s.y - dy / d * R
      }
      this.updateStick()
    }
  },
  end: function(e) {
    e.preventDefault()
    for(var i = 0; i < e.changedTouches.length; i++) {
      var id = e.changedTouches[i].identifier
      if(this.stick && id == this.stick.id) {
        this.stick = null
        this.updateStick()
      }
      if(this.held[id]) {
        var key = this.held[id]
        delete this.held[id]
        var still = false
        for(var other in this.held) if(this.held[other] == key) still = true
        if(!still) input.set(key, false)
      }
    }
  },
  // quantize the stick to the 8 directions and press the matching arrow keys
  updateStick: function() {
    var s = this.stick, dir = null
    if(s) {
      var dx = s.x - s.ox, dy = s.y - s.oy
      if(dx * dx + dy * dy > 16 * 16) dir = DIRS[Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) & 7]
    }
    input.set('RIGHT', !!dir && dir.x > 0.3)
    input.set('LEFT', !!dir && dir.x < -0.3)
    input.set('DOWN', !!dir && dir.y > 0.3)
    input.set('UP', !!dir && dir.y < -0.3)
  },

  render: function(ctx) {
    if(!this.active || this.game.state != 'play') return
    var g = this.game, i
    ctx.save()
    // joystick
    var home = this.stickHome(), s = this.stick
    var bx = s ? s.ox : home.x, by = s ? s.oy : home.y
    var kx = s ? s.x : bx, ky = s ? s.y : by
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 2
    Gfx.circle(ctx, bx, by, 70)
    ctx.fill()
    ctx.stroke()
    for(i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(bx + DIRS[i].x * 58 - 2, by + DIRS[i].y * 58 - 2, 4, 4)
    }
    ctx.fillStyle = s ? 'rgba(120,220,255,0.45)' : 'rgba(255,255,255,0.18)'
    Gfx.circle(ctx, kx, ky, 30)
    ctx.fill()
    ctx.stroke()
    // buttons
    var bs = this.buttons()
    for(i = 0; i < bs.length; i++) {
      var b = bs[i], down = input.isDown(b.key)
      ctx.fillStyle = down ? 'rgba(255,190,90,0.4)' : 'rgba(255,255,255,0.1)'
      ctx.strokeStyle = down ? 'rgba(255,210,120,0.9)' : 'rgba(255,255,255,0.35)'
      Gfx.circle(ctx, b.x, b.y, b.r)
      ctx.fill()
      ctx.stroke()
      g.text(ctx, b.label, b.x, b.y + 6, b.r > 50 ? 20 : 15, '#ffffff', 'center')
    }
    // pause
    var pb = this.pauseButton()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillRect(pb.x - 7, pb.y - 9, 5, 18)
    ctx.fillRect(pb.x + 2, pb.y - 9, 5, 18)
    ctx.restore()
  }
}
