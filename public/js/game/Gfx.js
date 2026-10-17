// Procedurally drawn graphics - every sprite is painted onto an offscreen canvas at startup

var Gfx = {
  sprites: {},
  tints: {},
  glows: {},

  canvas: function(w, h) {
    var c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  },
  rgba: function(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'
  },
  poly: function(g, pts) {
    g.beginPath()
    g.moveTo(pts[0], pts[1])
    for(var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    g.closePath()
  },
  ngon: function(g, n, r, rot) {
    var pts = []
    for(var i = 0; i < n; i++) {
      var a = (rot || 0) + i * Math.PI * 2 / n
      pts.push(Math.cos(a) * r, Math.sin(a) * r)
    }
    this.poly(g, pts)
  },
  circle: function(g, x, y, r) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
  },

  // white-hot radial glow, drawn scaled with additive blending
  glow: function(c) {
    var key = c[0] + ',' + c[1] + ',' + c[2]
    var cv = this.glows[key]
    if(!cv) {
      cv = this.canvas(64, 64)
      var g = cv.getContext('2d')
      var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.12, this.rgba(c, 0.95))
      grad.addColorStop(0.4, this.rgba(c, 0.35))
      grad.addColorStop(1, this.rgba(c, 0))
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      this.glows[key] = cv
    }
    return cv
  },
  drawGlow: function(ctx, x, y, r, c, alpha) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = alpha === undefined ? 1 : alpha
    ctx.drawImage(this.glow(c), x - r, y - r, r * 2, r * 2)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  },
  drawRot: function(ctx, spr, x, y, angle, alpha) {
    ctx.save()
    ctx.translate(x, y)
    if(angle) ctx.rotate(angle)
    if(alpha !== undefined) ctx.globalAlpha = alpha
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2)
    ctx.restore()
  },
  // single color silhouette of a sprite (hit flashes, shadows)
  tinted: function(name, color) {
    var key = name + color
    if(!this.tints[key]) {
      var src = this.sprites[name]
      var c = this.canvas(src.width, src.height), g = c.getContext('2d')
      g.drawImage(src, 0, 0)
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = color
      g.fillRect(0, 0, c.width, c.height)
      this.tints[key] = c
    }
    return this.tints[key]
  },
  drawShield: function(ctx, x, y, r, t) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    var grad = ctx.createRadialGradient(x, y, r * 0.55, x, y, r)
    grad.addColorStop(0, 'rgba(60,170,255,0)')
    grad.addColorStop(0.85, 'rgba(60,170,255,0.16)')
    grad.addColorStop(1, 'rgba(150,225,255,0.5)')
    ctx.fillStyle = grad
    this.circle(ctx, x, y, r)
    ctx.fill()
    ctx.strokeStyle = 'rgba(170,235,255,0.65)'
    ctx.lineWidth = 2
    for(var i = 0; i < 3; i++) {
      var a = t * 1.6 + i * Math.PI * 2 / 3
      ctx.beginPath()
      ctx.arc(x, y, r - 2, a, a + 0.9)
      ctx.stroke()
    }
    ctx.restore()
  },

  sprite: function(name, w, h, draw) {
    var c = this.canvas(w, h), g = c.getContext('2d')
    g.translate(w / 2, h / 2)
    draw.call(this, g)
    this.sprites[name] = c
  },
  init: function() {
    this.sprite('ship', 48, 48, this.drawShip)
    this.sprite('drone', 36, 36, this.drawDrone)
    this.sprite('fighter', 40, 40, this.drawFighter)
    this.sprite('turretBase', 40, 40, this.drawTurretBase)
    this.sprite('turretGun', 48, 48, this.drawTurretGun)
    this.sprite('mine', 30, 30, this.drawMine)
    this.sprite('spawner', 56, 56, this.drawSpawner)
    this.sprite('core', 68, 68, this.drawCore)
    this.sprite('generator', 44, 44, this.drawGenerator)
    this.sprite('boss', 124, 124, this.drawBoss)
    this.sprite('block', 32, 32, this.drawBlock)
    this.sprite('missile', 16, 16, this.drawMissile)
    this.sprite('pickupE', 32, 32, function(g) { this.drawPickup(g, '#8dffa8', '#17803a', 'E') })
    this.sprite('pickupP', 32, 32, function(g) { this.drawPickup(g, '#ffc27a', '#b0480e', 'P') })
    this.sprite('pickupM', 32, 32, function(g) { this.drawPickup(g, '#9ad4ff', '#1a4f9e', 'M') })
  },

  drawShip: function(g) {
    var grad = g.createLinearGradient(-18, 0, 18, 0)
    grad.addColorStop(0, '#4c5a6a')
    grad.addColorStop(0.5, '#e4edf5')
    grad.addColorStop(1, '#4c5a6a')
    g.fillStyle = grad
    this.poly(g, [0, -21, 5, -8, 18, 8, 18, 14, 7, 11, 5, 17, -5, 17, -7, 11, -18, 14, -18, 8, -5, -8])
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = '#18222e'
    g.stroke()
    g.fillStyle = '#ff7a1a'
    this.poly(g, [11, 6, 18, 9, 18, 12, 11, 9])
    g.fill()
    this.poly(g, [-11, 6, -18, 9, -18, 12, -11, 9])
    g.fill()
    g.fillStyle = '#8796a6'
    this.poly(g, [0, -19, 3, -6, 2, 15, -2, 15, -3, -6])
    g.fill()
    var cg = g.createLinearGradient(0, -12, 0, 2)
    cg.addColorStop(0, '#d8fbff')
    cg.addColorStop(1, '#147aa6')
    g.fillStyle = cg
    g.beginPath()
    g.ellipse(0, -5, 3, 7, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#26303b'
    g.fillRect(-6, 13, 4, 5)
    g.fillRect(2, 13, 4, 5)
  },
  drawDrone: function(g) {
    var grad = g.createRadialGradient(-4, -4, 2, 0, 0, 15)
    grad.addColorStop(0, '#9aa4ae')
    grad.addColorStop(1, '#2b3038')
    g.fillStyle = grad
    this.circle(g, 0, 0, 14)
    g.fill()
    g.strokeStyle = '#14171c'
    g.lineWidth = 1.5
    g.stroke()
    g.fillStyle = '#c23a2a'
    for(var i = 0; i < 3; i++) {
      g.save()
      g.rotate(i * Math.PI * 2 / 3)
      g.fillRect(-2, -14, 4, 6)
      g.restore()
    }
    g.fillStyle = '#121418'
    this.circle(g, 0, 0, 7)
    g.fill()
  },
  drawFighter: function(g) {
    var grad = g.createLinearGradient(0, -18, 0, 16)
    grad.addColorStop(0, '#d0508a')
    grad.addColorStop(1, '#4a1434')
    g.fillStyle = grad
    this.poly(g, [0, -18, 6, -4, 18, 10, 9, 8, 5, 15, -5, 15, -9, 8, -18, 10, -6, -4])
    g.fill()
    g.strokeStyle = '#1e0612'
    g.lineWidth = 1.5
    g.stroke()
    g.fillStyle = '#ffd34a'
    g.beginPath()
    g.ellipse(0, -3, 2.5, 5, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2a0a1a'
    g.fillRect(-14, 6, 3, 5)
    g.fillRect(11, 6, 3, 5)
  },
  drawTurretBase: function(g) {
    var grad = g.createRadialGradient(-5, -5, 2, 0, 0, 19)
    grad.addColorStop(0, '#8c95a0')
    grad.addColorStop(1, '#30353c')
    g.fillStyle = grad
    this.ngon(g, 8, 18, Math.PI / 8)
    g.fill()
    g.strokeStyle = '#15181c'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = '#1b1f24'
    this.circle(g, 0, 0, 11)
    g.fill()
    g.fillStyle = '#a8b0b8'
    for(var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4
      this.circle(g, Math.cos(a) * 14.5, Math.sin(a) * 14.5, 1.3)
      g.fill()
    }
  },
  drawTurretGun: function(g) {
    g.fillStyle = '#3b424b'
    g.fillRect(-3, -20, 6, 17)
    g.fillStyle = '#151a1f'
    g.fillRect(-3.5, -22, 7, 4)
    var grad = g.createRadialGradient(-2, -2, 1, 0, 0, 9)
    grad.addColorStop(0, '#a4adb7')
    grad.addColorStop(1, '#3a4048')
    g.fillStyle = grad
    this.circle(g, 0, 0, 8.5)
    g.fill()
    g.strokeStyle = '#15181c'
    g.lineWidth = 1.5
    g.stroke()
  },
  drawMine: function(g) {
    g.fillStyle = '#4a4f57'
    for(var i = 0; i < 8; i++) {
      g.save()
      g.rotate(i * Math.PI / 4)
      this.poly(g, [-2.5, -8, 0, -13.5, 2.5, -8])
      g.fill()
      g.restore()
    }
    var grad = g.createRadialGradient(-3, -3, 1, 0, 0, 9)
    grad.addColorStop(0, '#727984')
    grad.addColorStop(1, '#22262c')
    g.fillStyle = grad
    this.circle(g, 0, 0, 8.5)
    g.fill()
    g.strokeStyle = '#111'
    g.lineWidth = 1
    g.stroke()
  },
  drawSpawner: function(g) {
    var grad = g.createLinearGradient(-25, -25, 25, 25)
    grad.addColorStop(0, '#6e6478')
    grad.addColorStop(1, '#2a2430')
    g.fillStyle = grad
    this.ngon(g, 6, 25, 0)
    g.fill()
    g.strokeStyle = '#120e16'
    g.lineWidth = 2
    g.stroke()
    for(var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3
      g.save()
      g.rotate(a)
      g.fillStyle = (i % 2) ? '#e8c030' : '#1a1a1a'
      this.poly(g, [17, -5, 22, 0, 17, 5])
      g.fill()
      g.restore()
    }
    g.fillStyle = '#0e0a12'
    this.ngon(g, 6, 15, Math.PI / 6)
    g.fill()
  },
  drawCore: function(g) {
    var grad = g.createLinearGradient(-30, -30, 30, 30)
    grad.addColorStop(0, '#a3aab3')
    grad.addColorStop(1, '#3a3f47')
    g.fillStyle = grad
    this.poly(g, [-23, -30, 23, -30, 30, -23, 30, 23, 23, 30, -23, 30, -30, 23, -30, -23])
    g.fill()
    g.strokeStyle = '#16191d'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = 'rgba(0,0,0,0.3)'
    for(var i = 0; i < 4; i++) {
      g.save()
      g.rotate(i * Math.PI / 2)
      for(var k = -2; k <= 2; k++) g.fillRect(k * 7 - 2, -28, 4, 5)
      g.restore()
    }
    g.fillStyle = '#121418'
    this.circle(g, 0, 0, 20)
    g.fill()
    g.strokeStyle = '#ffb030'
    g.lineWidth = 2
    this.circle(g, 0, 0, 22)
    g.stroke()
    g.fillStyle = '#d0d6dc'
    var bolts = [[-24, -24], [24, -24], [-24, 24], [24, 24]]
    for(i = 0; i < 4; i++) {
      this.circle(g, bolts[i][0], bolts[i][1], 2)
      g.fill()
    }
  },
  drawGenerator: function(g) {
    var grad = g.createRadialGradient(-5, -5, 2, 0, 0, 20)
    grad.addColorStop(0, '#6d7a88')
    grad.addColorStop(1, '#232a33')
    g.fillStyle = grad
    this.circle(g, 0, 0, 19)
    g.fill()
    g.strokeStyle = '#11151a'
    g.lineWidth = 2
    g.stroke()
    for(var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4
      var x = Math.cos(a) * 12, y = Math.sin(a) * 12
      g.fillStyle = '#b8702f'
      this.circle(g, x, y, 5)
      g.fill()
      g.fillStyle = '#f2b673'
      this.circle(g, x - 1.5, y - 1.5, 2)
      g.fill()
    }
    g.fillStyle = '#20262e'
    this.circle(g, 0, 0, 6)
    g.fill()
    g.strokeStyle = '#7fe8ff'
    g.lineWidth = 1.5
    g.stroke()
  },
  drawBoss: function(g) {
    var grad = g.createRadialGradient(-15, -15, 10, 0, 0, 60)
    grad.addColorStop(0, '#7a6e80')
    grad.addColorStop(1, '#221b28')
    g.fillStyle = grad
    this.ngon(g, 8, 58, Math.PI / 8)
    g.fill()
    g.strokeStyle = '#0e0a12'
    g.lineWidth = 3
    g.stroke()
    g.strokeStyle = 'rgba(0,0,0,0.5)'
    g.lineWidth = 2
    for(var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + Math.PI / 8
      g.beginPath()
      g.moveTo(Math.cos(a) * 34, Math.sin(a) * 34)
      g.lineTo(Math.cos(a) * 58, Math.sin(a) * 58)
      g.stroke()
    }
    g.fillStyle = '#b8a8c0'
    for(i = 0; i < 16; i++) {
      a = i * Math.PI / 8
      this.circle(g, Math.cos(a) * 48, Math.sin(a) * 48, 1.8)
      g.fill()
    }
    g.fillStyle = '#140f18'
    this.circle(g, 0, 0, 32)
    g.fill()
    g.strokeStyle = '#ff4060'
    g.lineWidth = 2
    this.circle(g, 0, 0, 34)
    g.stroke()
  },
  drawBlock: function(g) {
    var grad = g.createLinearGradient(-16, -16, 16, 16)
    grad.addColorStop(0, '#a39c88')
    grad.addColorStop(1, '#4f4a3e')
    g.fillStyle = grad
    g.fillRect(-16, -16, 32, 32)
    g.fillStyle = 'rgba(255,255,255,0.25)'
    g.fillRect(-16, -16, 32, 3)
    g.fillRect(-16, -16, 3, 32)
    g.fillStyle = 'rgba(0,0,0,0.38)'
    g.fillRect(-16, 13, 32, 3)
    g.fillRect(13, -16, 3, 32)
    g.strokeStyle = 'rgba(0,0,0,0.35)'
    g.lineWidth = 2
    g.strokeRect(-10, -10, 20, 20)
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(-10, -10)
    g.lineTo(10, 10)
    g.moveTo(10, -10)
    g.lineTo(-10, 10)
    g.stroke()
    g.fillStyle = '#e8b830'
    this.poly(g, [-13, -13, -7, -13, -13, -7])
    g.fill()
  },
  drawMissile: function(g) {
    g.fillStyle = '#d8dde2'
    g.fillRect(-1.5, -6, 3, 10)
    g.fillStyle = '#ff5030'
    this.poly(g, [0, -8, 1.5, -6, -1.5, -6])
    g.fill()
    g.fillStyle = '#6a7480'
    this.poly(g, [-1.5, 2, -4, 5, -1.5, 4])
    g.fill()
    this.poly(g, [1.5, 2, 4, 5, 1.5, 4])
    g.fill()
  },
  drawPickup: function(g, light, dark, letter) {
    var grad = g.createLinearGradient(0, -13, 0, 13)
    grad.addColorStop(0, light)
    grad.addColorStop(1, dark)
    g.fillStyle = grad
    this.ngon(g, 6, 13, Math.PI / 6)
    g.fill()
    g.strokeStyle = '#ffffff'
    g.lineWidth = 2
    g.stroke()
    g.font = 'bold 15px "Courier New", monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = 'rgba(0,0,0,0.6)'
    g.fillText(letter, 1, 2)
    g.fillStyle = '#ffffff'
    g.fillText(letter, 0, 1)
  },

  // shaded, noise-textured planet for the title screen
  makePlanet: function(r, seed) {
    var size = r * 2, c = this.canvas(size, size), g = c.getContext('2d')
    var img = g.createImageData(size, size), d = img.data
    for(var y = 0; y < size; y++) {
      for(var x = 0; x < size; x++) {
        var dx = (x - r + 0.5) / r, dy = (y - r + 0.5) / r
        var d2 = dx * dx + dy * dy
        if(d2 > 1) continue
        var dz = Math.sqrt(1 - d2)
        var u = Math.atan2(dx, dz), v = Math.asin(dy)
        var n = Noise.fbm(u * 2.2 + 10, v * 3 + 10, seed, 5)
        var band = Math.sin(v * 14 + n * 9) * 0.08
        var k = Math.max(0, Math.min(1, (n - 0.3) * 2.2 + band))
        var light = Math.max(0.04, -dx * 0.55 - dy * 0.45 + dz * 0.7)
        var rim = Math.pow(1 - dz, 3)
        var i = (y * size + x) * 4
        d[i] = Math.min(255, (70 + 170 * k) * light + rim * 60)
        d[i + 1] = Math.min(255, (34 + 110 * k) * light + rim * 120)
        d[i + 2] = Math.min(255, (24 + 50 * k) * light + rim * 220)
        d[i + 3] = 255 * Math.min(1, (1 - Math.sqrt(d2)) * r)
      }
    }
    g.putImageData(img, 0, 0)
    return c
  }
}
