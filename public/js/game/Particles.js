// Lightweight particle system for sparks, fire, smoke and debris

var Particles = Base.extend({
  constructor: function() {
    this.list = []
  },
  add: function(type, x, y, vx, vy, life, size, color) {
    if(this.list.length >= 1800) return null
    var p = {
      type: type, x: x, y: y, vx: vx, vy: vy,
      life: life, max: life, size: size, color: color,
      css: 'rgb(' + (color[0] | 0) + ',' + (color[1] | 0) + ',' + (color[2] | 0) + ')',
      tex: null, drag: 0, grow: 0
    }
    if(type == 'glow') p.tex = Gfx.glow(color)
    this.list.push(p)
    return p
  },
  burst: function(x, y, n, speed, life, size, color, type) {
    for(var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7)
      var p = this.add(type || 'spark', x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), size, color)
      if(p) p.drag = 2.5
    }
  },
  explosion: function(x, y, scale) {
    var s = scale || 1, p, i, a, v
    this.add('glow', x, y, 0, 0, 0.2, 70 * s, [255, 220, 160])
    p = this.add('ring', x, y, 0, 0, 0.35 + 0.1 * s, 8 * s, [255, 200, 120])
    if(p) p.grow = 260 * s
    this.burst(x, y, Math.round(16 * s), 380 * s, 0.6, 2, [255, 190, 90])
    for(i = 0; i < 7 * s; i++) {
      a = Math.random() * Math.PI * 2
      v = Math.random() * 70 * s
      p = this.add('glow', x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s, Math.cos(a) * v, Math.sin(a) * v, 0.35 + Math.random() * 0.3, 10 * s, Math.random() < 0.5 ? [255, 150, 50] : [255, 90, 30])
      if(p) {
        p.grow = 40 * s
        p.drag = 2
      }
    }
    for(i = 0; i < 6 * s; i++) {
      a = Math.random() * Math.PI * 2
      v = 20 + Math.random() * 60 * s
      p = this.add('smoke', x, y, Math.cos(a) * v, Math.sin(a) * v, 0.9 + Math.random() * 0.8, 6 * s, [50, 46, 44])
      if(p) {
        p.grow = 22 * s
        p.drag = 1.5
      }
    }
    for(i = 0; i < 6 * s; i++) {
      a = Math.random() * Math.PI * 2
      v = 100 + Math.random() * 200 * s
      p = this.add('debris', x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5 + Math.random() * 0.6, 2 + Math.random() * 3, [70, 66, 62])
      if(p) p.drag = 2
    }
  },
  update: function(dt) {
    var list = this.list
    for(var i = list.length - 1; i >= 0; i--) {
      var p = list[i]
      p.life -= dt
      if(p.life <= 0) {
        list[i] = list[list.length - 1]
        list.pop()
        continue
      }
      if(p.drag) {
        var k = Math.max(0, 1 - p.drag * dt)
        p.vx *= k
        p.vy *= k
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.size += p.grow * dt
    }
  },
  render: function(ctx, view) {
    var list = this.list, i, p, a
    for(i = 0; i < list.length; i++) {
      p = list[i]
      if(p.type != 'smoke' && p.type != 'debris') continue
      if(view && (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1)) continue
      a = p.life / p.max
      ctx.fillStyle = p.css
      if(p.type == 'smoke') {
        ctx.globalAlpha = a * 0.45
        Gfx.circle(ctx, p.x, p.y, p.size)
        ctx.fill()
      } else {
        ctx.globalAlpha = Math.min(1, a * 2)
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
    }
    ctx.globalCompositeOperation = 'lighter'
    for(i = 0; i < list.length; i++) {
      p = list[i]
      if(p.type == 'smoke' || p.type == 'debris') continue
      if(view && (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1)) continue
      a = p.life / p.max
      ctx.globalAlpha = a
      if(p.type == 'spark') {
        ctx.strokeStyle = p.css
        ctx.lineWidth = p.size
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
        ctx.stroke()
      } else if(p.type == 'ring') {
        ctx.strokeStyle = p.css
        ctx.lineWidth = 1 + 4 * a
        Gfx.circle(ctx, p.x, p.y, p.size)
        ctx.stroke()
      } else {
        ctx.drawImage(p.tex, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
})
