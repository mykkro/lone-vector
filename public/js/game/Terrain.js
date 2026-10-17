// Per-pixel procedural terrain, rendered lazily into 512x512 chunk canvases

var CHUNK = 512

var Terrain = Base.extend({
  constructor: function(level) {
    this.level = level
    this.theme = level.def.theme
    this.seed = level.def.seed
    this.chunks = {}
    this.cols = Math.ceil(level.w * TS / CHUNK)
    this.rows = Math.ceil(level.h * TS / CHUNK)
    this.space = !!this.theme.space
    this.queue = this.space ? [['backdrop']] : []
    for(var cy = 0; cy < this.rows; cy++) {
      for(var cx = 0; cx < this.cols; cx++) this.queue.push([cx, cy])
    }
    this.total = this.queue.length
  },
  progress: function() {
    return 1 - this.queue.length / this.total
  },
  // render queued chunks for at most budgetMs (spread over the briefing screen)
  prerender: function(budgetMs) {
    var start = Date.now()
    while(this.queue.length && Date.now() - start < budgetMs) {
      var q = this.queue.shift()
      if(q[0] == 'backdrop') this.makeBackdrop()
      else this.getChunk(q[0], q[1])
    }
  },

  // ---- space backdrop: nebula + star layers drawn with parallax behind the chunks
  makeBackdrop: function() {
    if(this.nebula) return
    var th = this.theme, s = this.seed
    // nebula at half resolution, scrolled at 1/4 speed
    var nw = Math.ceil((960 + this.level.w * TS * 0.25) / 2), nh = Math.ceil((640 + this.level.h * TS * 0.25) / 2)
    var c = Gfx.canvas(nw, nh), g = c.getContext('2d')
    var img = g.createImageData(nw, nh), d = img.data
    for(var y = 0; y < nh; y++) {
      for(var x = 0; x < nw; x++) {
        var a = Noise.fbm(x / 110, y / 110, s + 31, 4), b = Noise.fbm(x / 70 + 40, y / 70, s + 32, 4)
        a = Math.max(0, (a - 0.45) * 2.6)
        b = Math.max(0, (b - 0.5) * 2.6)
        a *= a
        b *= b
        var i = (y * nw + x) * 4
        d[i] = 4 + th.nebulaA[0] * a + th.nebulaB[0] * b
        d[i + 1] = 5 + th.nebulaA[1] * a + th.nebulaB[1] * b
        d[i + 2] = 12 + th.nebulaA[2] * a + th.nebulaB[2] * b
        d[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    // distant stars are baked into the nebula layer
    var rng = new Rng(s + 33)
    for(var k = 0; k < nw * nh / 900; k++) {
      g.fillStyle = 'rgba(220,230,255,' + rng.range(0.2, 0.9) + ')'
      g.fillRect(rng.int(0, nw - 1), rng.int(0, nh - 1), 1, 1)
    }
    this.nebula = c
    // a sparse layer of near stars, wrapped around the screen, scrolls faster
    this.nearStars = []
    for(k = 0; k < 110; k++) {
      this.nearStars.push({ x: rng.range(0, 960), y: rng.range(0, 640), c: 'rgba(230,240,255,' + rng.range(0.5, 1) + ')', s: rng.chance(0.2) ? 2 : 1 })
    }
  },
  renderBackdrop: function(ctx, camX, camY, vw, vh) {
    this.makeBackdrop()
    // copy only the visible part of the half-resolution nebula
    ctx.drawImage(this.nebula, camX * 0.125, camY * 0.125, vw / 2, vh / 2, 0, 0, vw, vh)
    var ox = camX * 0.5, oy = camY * 0.5
    for(var i = 0; i < this.nearStars.length; i++) {
      var st = this.nearStars[i]
      ctx.fillStyle = st.c
      ctx.fillRect(((st.x - ox) % vw + vw) % vw, ((st.y - oy) % vh + vh) % vh, st.s, st.s)
    }
  },
  getChunk: function(cx, cy) {
    var key = cx + ',' + cy
    if(!this.chunks[key]) this.chunks[key] = this.renderChunk(cx, cy)
    return this.chunks[key]
  },
  render: function(ctx, camX, camY, vw, vh) {
    var cx0 = Math.max(0, Math.floor(camX / CHUNK)), cx1 = Math.min(this.cols - 1, Math.floor((camX + vw) / CHUNK))
    var cy0 = Math.max(0, Math.floor(camY / CHUNK)), cy1 = Math.min(this.rows - 1, Math.floor((camY + vh) / CHUNK))
    for(var cy = cy0; cy <= cy1; cy++) {
      for(var cx = cx0; cx <= cx1; cx++) {
        ctx.drawImage(this.getChunk(cx, cy), cx * CHUNK, cy * CHUNK)
      }
    }
  },

  // is this world pixel covered by rock / wall? Rock outlines are wobbled and rounded.
  solidPx: function(wx, wy) {
    var lv = this.level
    var t = lv.get(Math.floor(wx / TS), Math.floor(wy / TS))
    if(t == TILE.WALL) return true
    if(t == TILE.FLOOR) return false
    var px = wx + (Noise.value(wx * 0.07, wy * 0.07, this.seed + 7) - 0.5) * 10
    var py = wy + (Noise.value(wx * 0.07, wy * 0.07, this.seed + 8) - 0.5) * 10
    var tx = Math.floor(px / TS), ty = Math.floor(py / TS)
    if(lv.get(tx, ty) != TILE.ROCK) return false
    var lx = px - tx * TS, ly = py - ty * TS, R = 13
    var sx = lx < R ? -1 : (lx > TS - R ? 1 : 0)
    var sy = ly < R ? -1 : (ly > TS - R ? 1 : 0)
    if(sx && sy && !lv.solidTerrain(tx + sx, ty) && !lv.solidTerrain(tx, ty + sy)) {
      var dx = lx - (sx < 0 ? R : TS - R), dy = ly - (sy < 0 ? R : TS - R)
      if(dx * dx + dy * dy > R * R) return false
    }
    return true
  },

  renderChunk: function(cx, cy) {
    var B = 8, S = CHUNK + 2 * B
    var ox = cx * CHUNK, oy = cy * CHUNK
    var lv = this.level
    var mask = new Uint8Array(S * S)
    for(var y = 0; y < S; y++) {
      for(var x = 0; x < S; x++) mask[y * S + x] = this.solidPx(ox + x - B, oy + y - B) ? 1 : 0
    }

    var c = Gfx.canvas(CHUNK, CHUNK), g = c.getContext('2d')
    var img = g.createImageData(CHUNK, CHUNK), data = img.data
    var col = [0, 0, 0]
    for(var py = 0; py < CHUNK; py++) {
      for(var px = 0; px < CHUNK; px++) {
        var wx = ox + px, wy = oy + py
        var m = (py + B) * S + px + B
        var t = lv.get(wx >> 5, wy >> 5)
        var f
        var i = (py * CHUNK + px) * 4
        if(this.space && !mask[m] && t != TILE.FLOOR) {
          // empty space: leave transparent so the backdrop shows through
          data[i + 3] = 0
          continue
        }
        if(mask[m]) {
          // raised rock / wall, lit from the top-left
          if(t == TILE.WALL) this.wallColor(wx, wy, col)
          else this.rockColor(wx, wy, col)
          var hl = (mask[m - 3 * S - 3] ? 0 : 1) + (mask[m - 6 * S - 6] ? 0 : 0.6) + (mask[m - 4] ? 0 : 0.4) + (mask[m - 4 * S] ? 0 : 0.4)
          var sh = (mask[m + 3 * S + 3] ? 0 : 1) + (mask[m + 6 * S + 6] ? 0 : 0.6) + (mask[m + 4] ? 0 : 0.4) + (mask[m + 4 * S] ? 0 : 0.4)
          f = 1 + 0.2 * hl - 0.25 * sh
        } else {
          if(t == TILE.FLOOR) this.floorColor(wx, wy, col)
          else this.groundColor(wx, wy, col)
          // shadow cast towards the bottom-right
          f = mask[m - 5 * S - 5] ? 0.5 : (mask[m - 8 * S - 8] ? 0.7 : 1)
        }
        data[i] = col[0] * f
        data[i + 1] = col[1] * f
        data[i + 2] = col[2] * f
        data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    this.decorate(g, cx, cy)
    return c
  },

  groundColor: function(wx, wy, out) {
    var th = this.theme, s = this.seed
    var n = Noise.fbm(wx / 170, wy / 170, s + 1, 3)
    var m = Noise.fbm(wx / 24, wy / 24, s + 2, 2)
    var k = Math.max(0, Math.min(1, (n - 0.3) * 2.5))
    var lum = 0.8 + 0.4 * m + (Noise.hash(wx, wy, s) - 0.5) * 0.06
    if(th.name == 'desert') lum *= 1 + 0.07 * Math.sin(wx * 0.11 + wy * 0.05 + n * 30)
    out[0] = (th.groundA[0] + (th.groundB[0] - th.groundA[0]) * k) * lum
    out[1] = (th.groundA[1] + (th.groundB[1] - th.groundA[1]) * k) * lum
    out[2] = (th.groundA[2] + (th.groundB[2] - th.groundA[2]) * k) * lum
    if(th.name == 'ice') {
      var cr = Math.abs(Noise.fbm(wx / 90, wy / 90, s + 3, 2) - 0.5)
      if(cr < 0.012) {
        var dk = 0.7 + cr * 25
        out[0] *= dk
        out[1] *= dk
        out[2] *= dk
      }
    }
    if(th.glow) {
      // glowing magma fissures
      var lc = Math.abs(Noise.fbm(wx / 80, wy / 80, s + 3, 3) - 0.5)
      if(lc < 0.022) {
        var gl = 1 - lc / 0.022
        gl *= gl
        out[0] += (th.glow[0] - out[0]) * gl
        out[1] += (th.glow[1] * (0.6 + 0.4 * gl) - out[1]) * gl
        out[2] += (th.glow[2] - out[2]) * gl
      }
    }
  },
  rockColor: function(wx, wy, out) {
    var th = this.theme, s = this.seed
    var n = Noise.fbm(wx / 30, wy / 30, s + 4, 3)
    var k = Math.max(0, Math.min(1, (n - 0.25) * 2))
    var lum = 0.85 + Math.sin((wy + n * 60) * 0.18) * 0.07 + (Noise.hash(wx, wy, s + 1) - 0.5) * 0.08
    out[0] = (th.rockA[0] + (th.rockB[0] - th.rockA[0]) * k) * lum
    out[1] = (th.rockA[1] + (th.rockB[1] - th.rockA[1]) * k) * lum
    out[2] = (th.rockA[2] + (th.rockB[2] - th.rockA[2]) * k) * lum
  },
  floorColor: function(wx, wy, out) {
    var th = this.theme
    var lx = wx & 31, ly = wy & 31, tx = wx >> 5, ty = wy >> 5
    var lum = 0.92 + 0.12 * (Noise.value(wx / 5, wy / 40, this.seed + 5) - 0.5)
    if(((tx >> 1) + (ty >> 1)) & 1) lum *= 0.92
    if(lx == 0 || ly == 0) lum *= 0.6
    else if(lx == 1 || ly == 1) lum *= 1.14
    var rx = lx < 16 ? lx - 4 : lx - 27, ry = ly < 16 ? ly - 4 : ly - 27
    if(rx * rx + ry * ry < 3) lum *= 1.35
    out[0] = th.metal[0] * lum
    out[1] = th.metal[1] * lum
    out[2] = th.metal[2] * lum
  },
  wallColor: function(wx, wy, out) {
    var th = this.theme
    var lum = 0.95 + 0.1 * (Noise.value(wx / 4, wy / 4, this.seed + 6) - 0.5)
    if(((wx + wy) >> 3) & 1) lum *= 0.9
    out[0] = th.wall[0] * lum
    out[1] = th.wall[1] * lum
    out[2] = th.wall[2] * lum
  },

  // vector details on top of the pixel layer: craters, crystals, vents, lights
  decorate: function(g, cx, cy) {
    var lv = this.level, th = this.theme, s = this.seed
    g.save()
    g.translate(-cx * CHUNK, -cy * CHUNK)
    for(var ty = cy * 16 - 1; ty <= cy * 16 + 16; ty++) {
      for(var tx = cx * 16 - 1; tx <= cx * 16 + 16; tx++) {
        var t = lv.get(tx, ty)
        var h1 = Noise.hash(tx, ty, s + 99), h2 = Noise.hash(tx, ty, s + 100), h3 = Noise.hash(tx, ty, s + 101)
        var x = (tx + 0.25 + h2 * 0.5) * TS, y = (ty + 0.25 + h3 * 0.5) * TS
        if(t == TILE.GROUND && !this.space && lv.openAround(tx, ty, 1)) {
          if(h1 < 0.05) this.crater(g, x, y, 8 + h2 * 16)
          else if(h1 < 0.12) this.detail(g, x, y, h2, h3)
        } else if(t == TILE.FLOOR && h1 < 0.06) {
          g.fillStyle = 'rgba(0,0,0,0.45)'
          g.fillRect(tx * TS + 8, ty * TS + 8, 16, 16)
          g.fillStyle = 'rgba(255,255,255,0.12)'
          for(var k = 0; k < 4; k++) g.fillRect(tx * TS + 9, ty * TS + 10 + k * 4, 14, 1.5)
        } else if(t == TILE.WALL && h1 < 0.15) {
          Gfx.drawGlow(g, (tx + 0.5) * TS, (ty + 0.5) * TS, 8 + h2 * 4, th.accent, 0.8)
        }
      }
    }
    g.restore()
  },
  crater: function(g, x, y, r) {
    var th = this.theme
    var grad = g.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r)
    if(th.glow) {
      grad.addColorStop(0, 'rgba(255,200,80,0.9)')
      grad.addColorStop(0.45, 'rgba(255,90,20,0.6)')
      grad.addColorStop(0.8, 'rgba(40,10,0,0.4)')
    } else {
      grad.addColorStop(0, 'rgba(0,0,0,0.35)')
      grad.addColorStop(0.7, 'rgba(0,0,0,0.15)')
      grad.addColorStop(0.86, 'rgba(255,255,255,0.14)')
    }
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    Gfx.circle(g, x, y, r)
    g.fill()
  },
  detail: function(g, x, y, a, b) {
    var th = this.theme
    if(th.name == 'ice') {
      // crystal cluster
      for(var i = 0; i < 4; i++) {
        var ang = a * 6 + i * 1.7, len = 6 + ((b * 10 + i * 3) % 6)
        g.save()
        g.translate(x, y)
        g.rotate(ang)
        g.fillStyle = i % 2 ? 'rgba(200,245,255,0.85)' : 'rgba(120,200,240,0.85)'
        Gfx.poly(g, [0, 0, 2.5, -len * 0.6, 0, -len, -2.5, -len * 0.6])
        g.fill()
        g.restore()
      }
    } else {
      // pebbles
      for(i = 0; i < 3; i++) {
        var px = x + Math.cos(a * 9 + i * 2.1) * 6, py = y + Math.sin(b * 9 + i * 2.1) * 5
        var r = 2 + ((a + b + i) * 7 % 2.5)
        g.fillStyle = 'rgba(0,0,0,0.3)'
        Gfx.circle(g, px + 1.5, py + 1.5, r)
        g.fill()
        g.fillStyle = th.glow ? 'rgba(90,70,66,1)' : 'rgba(' + th.rockB.join(',') + ',1)'
        Gfx.circle(g, px, py, r)
        g.fill()
      }
    }
  }
})
