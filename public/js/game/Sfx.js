// Synthesized sound effects (WebAudio) - no sample files needed

var Sfx = {
  ctx: null,
  muted: false,
  last: {},

  // must be called from a user gesture (key press) because of autoplay rules
  init: function() {
    if(this.ctx) {
      if(this.ctx.state == 'suspended') this.ctx.resume()
      return
    }
    var AC = window.AudioContext || window.webkitAudioContext
    if(!AC) return
    try {
      this.ctx = new AC()
    } catch(e) {
      return
    }
    this.out = this.ctx.createGain()
    this.out.gain.value = 0.3
    this.out.connect(this.ctx.destination)
    var len = this.ctx.sampleRate
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    var data = this.noiseBuf.getChannelData(0)
    for(var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  },
  toggleMute: function() {
    this.muted = !this.muted
  },
  tone: function(type, f0, f1, dur, vol, delay) {
    var c = this.ctx, t = c.currentTime + (delay || 0)
    var o = c.createOscillator(), g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(this.out)
    o.start(t)
    o.stop(t + dur + 0.02)
  },
  noise: function(dur, vol, f0, f1, delay) {
    var c = this.ctx, t = c.currentTime + (delay || 0)
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf
    s.loop = true
    f.type = 'lowpass'
    f.frequency.setValueAtTime(f0, t)
    f.frequency.exponentialRampToValueAtTime(f1, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f)
    f.connect(g)
    g.connect(this.out)
    s.start(t)
    s.stop(t + dur + 0.02)
  },
  play: function(name) {
    if(!this.ctx || this.muted) return
    var now = this.ctx.currentTime
    if(this.last[name] && now - this.last[name] < 0.045) return
    this.last[name] = now
    switch(name) {
      case 'shoot':
        this.tone('square', 1100, 320, 0.07, 0.07)
        break
      case 'missile':
        this.tone('sawtooth', 180, 700, 0.3, 0.08)
        this.noise(0.3, 0.12, 3000, 600)
        break
      case 'enemyShoot':
        this.tone('square', 420, 180, 0.12, 0.05)
        break
      case 'hit':
        this.noise(0.12, 0.35, 4000, 400)
        this.tone('square', 220, 90, 0.12, 0.08)
        break
      case 'ping':
        this.tone('triangle', 1900, 1700, 0.09, 0.08)
        break
      case 'block':
        this.noise(0.05, 0.12, 2500, 1200)
        break
      case 'explode':
        this.noise(0.5, 0.45, 1800, 80)
        this.tone('sine', 140, 40, 0.4, 0.25)
        break
      case 'bigExplode':
        this.noise(1.5, 0.7, 1200, 40)
        this.tone('sine', 90, 25, 1.3, 0.45)
        break
      case 'bump':
        this.noise(0.15, 0.3, 700, 150)
        break
      case 'pickup':
        this.tone('sine', 660, 660, 0.08, 0.15)
        this.tone('sine', 990, 990, 0.08, 0.15, 0.07)
        this.tone('sine', 1320, 1320, 0.14, 0.15, 0.14)
        break
      case 'alarm':
        this.tone('square', 880, 860, 0.12, 0.05)
        break
      case 'arm':
        this.tone('square', 1400, 1400, 0.06, 0.06)
        break
      case 'shieldDown':
        this.tone('sawtooth', 900, 80, 0.8, 0.12)
        break
      case 'spawn':
        this.tone('triangle', 200, 900, 0.3, 0.06)
        break
      case 'warp':
        this.tone('sine', 150, 1800, 1.3, 0.2)
        this.tone('triangle', 300, 3600, 1.3, 0.08)
        break
      case 'die':
        this.noise(1.4, 0.7, 2500, 60)
        this.tone('sawtooth', 500, 30, 1.2, 0.18)
        break
      case 'start':
        this.tone('square', 392, 392, 0.1, 0.06)
        this.tone('square', 523, 523, 0.1, 0.06, 0.1)
        this.tone('square', 659, 659, 0.1, 0.06, 0.2)
        this.tone('square', 784, 784, 0.3, 0.06, 0.3)
        break
    }
  }
}
