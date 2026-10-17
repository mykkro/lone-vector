// Seeded pseudo random numbers and value noise - drives all procedural content

var Rng = Base.extend({
  constructor: function(seed) {
    this.state = (seed >>> 0) || 1
  },
  // mulberry32
  next: function() {
    var t = this.state = (this.state + 0x6D2B79F5) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  },
  range: function(a, b) {
    return a + (b - a) * this.next()
  },
  int: function(a, b) {
    return a + Math.floor((b - a + 1) * this.next())
  },
  chance: function(p) {
    return this.next() < p
  },
  pick: function(list) {
    return list[Math.floor(this.next() * list.length)]
  },
  shuffle: function(list) {
    for(var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1))
      var tmp = list[i]
      list[i] = list[j]
      list[j] = tmp
    }
    return list
  }
})

var Noise = {
  hash: function(x, y, seed) {
    var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  },
  value: function(x, y, seed) {
    var x0 = Math.floor(x), y0 = Math.floor(y)
    var fx = x - x0, fy = y - y0
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    var a = this.hash(x0, y0, seed), b = this.hash(x0 + 1, y0, seed)
    var c = this.hash(x0, y0 + 1, seed), d = this.hash(x0 + 1, y0 + 1, seed)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  },
  fbm: function(x, y, seed, octaves) {
    var sum = 0, amp = 0.5, norm = 0, f = 1
    for(var i = 0; i < octaves; i++) {
      sum += amp * this.value(x * f, y * f, seed + i * 131)
      norm += amp
      amp *= 0.5
      f *= 2.03
    }
    return sum / norm
  }
}
