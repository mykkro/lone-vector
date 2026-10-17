// Lone Vector mission editor: paint terrain, stamp bases, place objects, play-test

var EDITOR_TOOLS = [
  { id: 'ground', group: 'terrain', tile: TILE.GROUND, key: '1', label: 'Ground', spaceLabel: 'Empty space' },
  { id: 'rock', group: 'terrain', tile: TILE.ROCK, key: '2', label: 'Rock', spaceLabel: 'Asteroid' },
  { id: 'floor', group: 'terrain', tile: TILE.FLOOR, key: '3', label: 'Base floor' },
  { id: 'wall', group: 'terrain', tile: TILE.WALL, key: '4', label: 'Base wall' },
  { id: 'block', group: 'terrain', key: '5', label: 'Armored block (destructible, on base floor)' },
  { id: 'stamp', group: 'bases', key: 'b', label: 'Base stamp: walled grid of cells with doors' },
  { id: 'spawn', group: 'objects', key: 'l', label: 'Landing zone and warp gate' },
  { id: 'core', group: 'objects', entity: 'core', key: 'c', label: 'Reactor core (target)' },
  { id: 'boss', group: 'objects', entity: 'boss', key: 'o', label: 'Mothercore (target, boss)' },
  { id: 'generator', group: 'objects', entity: 'generator', key: 'g', label: 'Shield generator: shields the cores in its own base' },
  { id: 'rgen', group: 'objects', entity: 'generator', remote: true, key: 'r', label: 'Remote generator: shields the Mothercore' },
  { id: 'turret', group: 'objects', entity: 'turret', key: 't', label: 'Gun turret' },
  { id: 'spawner', group: 'objects', entity: 'spawner', key: 'n', label: 'Drone spawner' },
  { id: 'drone', group: 'objects', entity: 'drone', key: 'd', label: 'Drone (rams you)' },
  { id: 'fighter', group: 'objects', entity: 'fighter', key: 'f', label: 'Fighter (shoots)' },
  { id: 'mine', group: 'objects', entity: 'mine', key: 'm', label: 'Mine' },
  { id: 'pickupE', group: 'objects', entity: 'pickup', kind: 'E', key: 'e', label: 'Energy capsule' },
  { id: 'pickupP', group: 'objects', entity: 'pickup', kind: 'P', key: 'p', label: 'Cannon upgrade' },
  { id: 'pickupM', group: 'objects', entity: 'pickup', kind: 'M', key: 'k', label: 'Missiles' },
  { id: 'select', group: 'edit', key: 'v', label: 'Select / move objects' },
  { id: 'erase', group: 'edit', key: 'x', label: 'Eraser (objects and blocks)' }
]

var ENTITY_INFO = {
  core: { sprite: 'core', name: 'Reactor core', r: 27 },
  boss: { sprite: 'boss', name: 'Mothercore', r: 48 },
  generator: { sprite: 'generator', name: 'Shield generator', r: 18 },
  turret: { sprite: 'turretBase', name: 'Gun turret', r: 15 },
  spawner: { sprite: 'spawner', name: 'Drone spawner', r: 24 },
  drone: { sprite: 'drone', name: 'Drone', r: 12 },
  fighter: { sprite: 'fighter', name: 'Fighter', r: 14 },
  mine: { sprite: 'mine', name: 'Mine', r: 10 },
  pickup: { sprite: 'pickupE', name: 'Pickup', r: 14 }
}

var STORE_DRAFT = 'lonevector.editor.draft'
var STORE_LIBRARY = 'lonevector.editor.library'

var $ = function(id) {
  return document.getElementById(id)
}

var Editor = Base.extend({
  constructor: function() {
    this.canvas = $('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.cam = { x: 0, y: 0, zoom: 0.5 }
    this.tool = 'wall'
    this.shape = 'brush'
    this.brush = 1
    this.preview = true
    this.grid = true
    this.undoStack = []
    this.redoStack = []
    this.selected = null
    this.hover = null
    this.drag = null
    this.spaceDown = false
    this.lastEdit = 0
    this.needsRender = true
    this.problems = []
    this.libraryId = null
    this.unsaved = false

    this.buildToolbar()
    this.setTool(this.tool)
    this.bindUI()
    this.bindCanvas()
    this.bindKeys()

    var draft = this.readStore(STORE_DRAFT)
    var loaded = false
    if(draft && draft.mission) {
      try {
        this.loadMission(Mission.parse(JSON.stringify(draft.mission)))
        this.libraryId = draft.libraryId || null
        this.unsaved = !!draft.unsaved
        loaded = true
      } catch(e) {
        console.warn('Could not restore the editor draft', e)
      }
    }
    if(!loaded) this.newFromTemplate(0, LEVELS[0].seed)
    this.renderLibrary()

    var self = this
    window.addEventListener('resize', function() { self.resizeCanvas() })
    this.resizeCanvas()
    this.fitView()
    var loop = function() {
      self.frame()
      requestAnimationFrame(loop)
    }
    loop()
  },

  // ------------------------------------------------------------ mission state

  toMission: function() {
    var ents = this.entities.map(function(e) {
      var o = { type: e.type, tx: e.tx, ty: e.ty }
      if(e.type == 'pickup') o.kind = e.kind || 'E'
      if(e.type == 'generator' && e.remote) o.remote = true
      return o
    })
    return Mission.fromLevel(this.level, this.info, ents)
  },
  loadMission: function(m, keepView) {
    var old = this.level, oldTerrain = this.terrain
    this.info = {
      name: m.name || 'New mission',
      place: m.place || '',
      theme: Mission.THEMES.indexOf(m.theme) >= 0 ? m.theme : 'desert',
      briefing: (m.briefing || []).slice(),
      drain: m.drain || 1,
      par: m.par || 240,
      turretBurst: m.turretBurst || 1,
      seed: m.seed || 1
    }
    m.theme = this.info.theme
    this.level = new Level(Mission.toDef(m))
    this.entities = m.entities.map(function(e) {
      return { type: e.type, tx: e.tx, ty: e.ty, kind: e.kind, remote: !!e.remote }
    })
    this.terrain = new Terrain(this.level)
    // keep the rendered preview where nothing changed (undo / redo)
    if(keepView && old && oldTerrain && old.w == this.level.w && old.h == this.level.h && old.def.theme == this.level.def.theme) {
      for(var key in oldTerrain.chunks) this.terrain.chunks[key] = oldTerrain.chunks[key]
      for(var i = 0; i < old.tiles.length; i++) {
        if(old.tiles[i] != this.level.tiles[i]) {
          var tx = i % old.w, ty = (i / old.w) | 0
          this.terrain.invalidate(tx, ty, tx, ty)
        }
      }
    }
    this.selected = null
    this.instDirty = false
    this.fillForm()
    this.refreshIcons()
    this.renderSelected()
    if(!keepView) this.fitView()
    this.validate()
    this.needsRender = true
  },
  // call after every edit
  changed: function(tx0, ty0, tx1, ty1) {
    if(tx0 !== undefined) this.terrain.invalidate(tx0, ty0, tx1, ty1)
    this.instDirty = true
    this.lastEdit = Date.now()
    this.validateAt = Date.now() + 250
    this.draftAt = Date.now() + 800
    this.needsRender = true
    if(!this.unsaved) {
      this.unsaved = true
      this.renderLibrary()
    }
  },
  snapshot: function() {
    this.undoStack.push(JSON.stringify(this.toMission()))
    if(this.undoStack.length > 80) this.undoStack.shift()
    this.redoStack = []
  },
  undo: function() {
    if(!this.undoStack.length) return
    this.redoStack.push(JSON.stringify(this.toMission()))
    this.loadMission(JSON.parse(this.undoStack.pop()), true)
    this.changed()
  },
  redo: function() {
    if(!this.redoStack.length) return
    this.undoStack.push(JSON.stringify(this.toMission()))
    this.loadMission(JSON.parse(this.redoStack.pop()), true)
    this.changed()
  },
  syncInstallations: function() {
    if(!this.instDirty) return
    this.level.findInstallations()
    this.instDirty = false
  },
  validate: function() {
    this.syncInstallations()
    this.problems = Mission.validate(this.level, this.entities)
    var list = $('problems'), self = this
    list.innerHTML = ''
    if(!this.problems.length) {
      var ok = document.createElement('li')
      ok.className = 'ok'
      ok.textContent = 'Ready to play'
      list.appendChild(ok)
    }
    this.problems.forEach(function(p) {
      var li = document.createElement('li')
      li.className = p.level
      li.textContent = p.text
      if(p.tx !== undefined) {
        li.title = 'Show on map'
        li.addEventListener('click', function() { self.centerOn(p.tx, p.ty) })
      }
      list.appendChild(li)
    })
    this.needsRender = true
  },

  // ------------------------------------------------------------ new / save / load

  blankMission: function(theme, w, h) {
    var tiles = []
    for(var ty = 0; ty < h; ty++) {
      for(var tx = 0; tx < w; tx++) tiles.push(Math.min(tx, ty, w - 1 - tx, h - 1 - ty) < 2 ? TILE.ROCK : TILE.GROUND)
    }
    return {
      format: Mission.FORMAT, version: Mission.VERSION,
      name: 'New mission', place: '', theme: theme,
      briefing: ['Destroy every reactor core,', 'then return to the warp gate.'],
      drain: 1, par: 240, turretBurst: 1, seed: 1,
      w: w, h: h, tiles: tiles.join(''), blocks: [], spawn: [6, h - 7], entities: []
    }
  },
  newFromTemplate: function(index, seed) {
    var def = {}, src = LEVELS[index]
    for(var k in src) def[k] = src[k]
    def.seed = seed
    var m = Mission.fromLevel(new Level(def))
    if(seed != src.seed) m.name = src.name + ' ' + seed
    this.loadMission(m)
  },
  readStore: function(key) {
    try {
      return JSON.parse(localStorage.getItem(key))
    } catch(e) {
      return null
    }
  },
  writeStore: function(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch(e) {
      return false
    }
  },
  saveDraft: function() {
    this.writeStore(STORE_DRAFT, { mission: this.toMission(), libraryId: this.libraryId, unsaved: this.unsaved })
  },
  save: function() {
    var lib = this.readStore(STORE_LIBRARY) || {}
    if(!this.libraryId || !lib[this.libraryId]) this.libraryId = 'm' + Date.now()
    lib[this.libraryId] = { saved: Date.now(), mission: this.toMission() }
    if(!this.writeStore(STORE_LIBRARY, lib)) {
      this.toast('Could not save: browser storage is unavailable. Use Export instead.')
      return
    }
    this.unsaved = false
    this.saveDraft()
    this.renderLibrary()
    this.toast('Saved "' + this.info.name + '"')
  },
  renderLibrary: function() {
    var lib = this.readStore(STORE_LIBRARY) || {}, list = $('library'), self = this
    var ids = Object.keys(lib).sort(function(a, b) { return lib[b].saved - lib[a].saved })
    list.innerHTML = ''
    if(!ids.length) {
      list.innerHTML = '<li class="muted">Nothing saved yet</li>'
      return
    }
    ids.forEach(function(id) {
      var entry = lib[id], m = entry.mission
      var li = document.createElement('li')
      if(id == self.libraryId) li.className = 'current'
      var name = document.createElement('span')
      name.className = 'name'
      name.textContent = m.name + (id == self.libraryId && self.unsaved ? ' *' : '')
      var meta = document.createElement('span')
      meta.className = 'meta'
      meta.textContent = m.w + 'x' + m.h
      var del = document.createElement('button')
      del.textContent = 'x'
      del.title = 'Delete'
      del.addEventListener('click', function(e) {
        e.stopPropagation()
        if(!confirm('Delete "' + m.name + '" from this browser?')) return
        delete lib[id]
        self.writeStore(STORE_LIBRARY, lib)
        if(self.libraryId == id) self.libraryId = null
        self.renderLibrary()
      })
      li.appendChild(name)
      li.appendChild(meta)
      li.appendChild(del)
      li.addEventListener('click', function() {
        if(self.unsaved && !confirm('Discard unsaved changes to "' + self.info.name + '"?')) return
        self.snapshot()
        self.loadMission(Mission.parse(JSON.stringify(m)))
        self.libraryId = id
        self.unsaved = false
        self.saveDraft()
        self.renderLibrary()
      })
      list.appendChild(li)
    })
  },
  exportFile: function() {
    var m = this.toMission()
    var blob = new Blob([JSON.stringify(m, null, 1)], { type: 'application/json' })
    var a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = (m.name || 'mission').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.lonevector.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(function() { URL.revokeObjectURL(a.href) }, 1000)
  },
  importFile: function(file) {
    var self = this
    file.text().then(function(text) {
      try {
        var m = Mission.parse(text)
        self.snapshot()
        self.loadMission(m)
        self.libraryId = null
        self.changed()
        self.toast('Imported "' + m.name + '"')
      } catch(e) {
        alert('Cannot import this file: ' + e.message)
      }
    })
  },

  // ------------------------------------------------------------ UI

  buildToolbar: function() {
    var self = this
    this.toolButtons = {}
    EDITOR_TOOLS.forEach(function(t) {
      var b = document.createElement('button')
      b.title = t.label + ' (' + t.key.toUpperCase() + ')'
      var icon = Gfx.canvas(34, 34)
      b.appendChild(icon)
      var key = document.createElement('span')
      key.className = 'key'
      key.textContent = t.key
      b.appendChild(key)
      b.addEventListener('click', function() { self.setTool(t.id) })
      document.querySelector('.toolgrid[data-group="' + t.group + '"]').appendChild(b)
      self.toolButtons[t.id] = { button: b, icon: icon, tool: t }
    })
  },
  refreshIcons: function() {
    var th = THEMES[this.info.theme]
    for(var id in this.toolButtons) {
      var tb = this.toolButtons[id], t = tb.tool, g = tb.icon.getContext('2d')
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, 34, 34)
      if(t.tile !== undefined) {
        g.fillStyle = this.tileColor(t.tile) || '#05070f'
        g.fillRect(5, 5, 24, 24)
        g.strokeStyle = 'rgba(255,255,255,0.25)'
        g.strokeRect(5.5, 5.5, 23, 23)
        if(th.space && t.tile == TILE.GROUND) {
          g.fillStyle = '#fff'
          g.fillRect(10, 11, 1, 1)
          g.fillRect(21, 15, 1, 1)
          g.fillRect(14, 23, 1, 1)
        }
        tb.button.title = (th.space && t.spaceLabel ? t.spaceLabel : t.label) + ' (' + t.key + ')'
      } else if(t.id == 'block') {
        g.drawImage(Gfx.sprites.block, 3, 3, 28, 28)
      } else if(t.id == 'stamp') {
        g.fillStyle = this.tileColor(TILE.FLOOR)
        g.fillRect(4, 7, 26, 20)
        g.strokeStyle = this.tileColor(TILE.WALL)
        g.lineWidth = 2
        g.strokeRect(4, 7, 26, 20)
        g.beginPath()
        g.moveTo(17, 7)
        g.lineTo(17, 14)
        g.moveTo(17, 20)
        g.lineTo(17, 27)
        g.stroke()
      } else if(t.id == 'spawn') {
        this.drawSpawnIcon(g, 17, 17, 13)
      } else if(t.entity) {
        var spr = Gfx.sprites[t.entity == 'pickup' ? 'pickup' + t.kind : ENTITY_INFO[t.entity].sprite]
        var s = Math.min(1, 30 / Math.max(spr.width, spr.height))
        g.drawImage(spr, 17 - spr.width * s / 2, 17 - spr.height * s / 2, spr.width * s, spr.height * s)
        if(t.entity == 'turret') g.drawImage(Gfx.sprites.turretGun, 17 - 24 * s, 17 - 24 * s, 48 * s, 48 * s)
        if(t.remote) this.drawRemoteBadge(g, 25, 9)
      } else {
        g.fillStyle = '#d6dde8'
        g.font = 'bold 18px sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(t.id == 'select' ? '↖' : '✕', 17, 18)
      }
    }
  },
  drawSpawnIcon: function(g, x, y, r) {
    g.strokeStyle = '#5affc8'
    g.lineWidth = Math.max(1.5, r / 6)
    Gfx.circle(g, x, y, r)
    g.stroke()
    g.fillStyle = '#5affc8'
    g.font = 'bold ' + Math.round(r * 0.8) + 'px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('LZ', x, y + 1)
  },
  drawRemoteBadge: function(g, x, y) {
    g.fillStyle = '#b070ff'
    Gfx.circle(g, x, y, 6)
    g.fill()
    g.fillStyle = '#fff'
    g.font = 'bold 9px sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('R', x, y + 1)
  },
  setTool: function(id) {
    this.tool = id
    for(var k in this.toolButtons) this.toolButtons[k].button.classList.toggle('on', k == id)
    this.needsRender = true
  },
  currentTool: function() {
    return this.toolButtons[this.tool].tool
  },
  bindUI: function() {
    var self = this
    $('btn-new').addEventListener('click', function() { self.openNewDialog() })
    $('btn-save').addEventListener('click', function() { self.save() })
    $('btn-export').addEventListener('click', function() { self.exportFile() })
    $('btn-import').addEventListener('click', function() { $('file-import').click() })
    $('file-import').addEventListener('change', function() {
      if(this.files[0]) self.importFile(this.files[0])
      this.value = ''
    })
    $('btn-undo').addEventListener('click', function() { self.undo() })
    $('btn-redo').addEventListener('click', function() { self.redo() })
    $('btn-play').addEventListener('click', function() { self.play() })
    $('opt-preview').addEventListener('change', function() {
      self.preview = this.checked
      self.needsRender = true
    })
    $('opt-grid').addEventListener('change', function() {
      self.grid = this.checked
      self.needsRender = true
    })
    document.querySelectorAll('#shape button').forEach(function(b) {
      b.addEventListener('click', function() {
        self.shape = b.dataset.shape
        document.querySelectorAll('#shape button').forEach(function(o) { o.classList.toggle('on', o == b) })
      })
    })
    document.querySelectorAll('#brush button').forEach(function(b) {
      b.addEventListener('click', function() {
        self.brush = parseInt(b.dataset.size, 10)
        document.querySelectorAll('#brush button').forEach(function(o) { o.classList.toggle('on', o == b) })
      })
    })

    // mission properties
    var text = function(id, field) {
      $(id).addEventListener('input', function() {
        self.info[field] = this.value
        self.changed()
      })
    }
    text('f-name', 'name')
    text('f-place', 'place')
    $('f-brief').addEventListener('input', function() {
      self.info.briefing = this.value.split('\n')
      self.changed()
    })
    var num = function(id, field, min, max) {
      $(id).addEventListener('change', function() {
        var v = Math.max(min, Math.min(max, Number(this.value) || min))
        this.value = v
        self.info[field] = v
        self.changed()
      })
    }
    num('f-drain', 'drain', 0, 5)
    num('f-par', 'par', 30, 1800)
    num('f-burst', 'turretBurst', 1, 3)
    $('f-theme').addEventListener('change', function() {
      self.snapshot()
      self.info.theme = this.value
      self.level.def.theme = THEMES[this.value]
      self.terrain = new Terrain(self.level)
      self.refreshIcons()
      self.changed()
    })
    $('btn-resize').addEventListener('click', function() { self.resizeMap(Number($('f-w').value), Number($('f-h').value)) })

    // new mission dialog
    var sel = $('new-template')
    LEVELS.forEach(function(l, i) {
      var o = document.createElement('option')
      o.value = i
      o.textContent = (i + 1) + '. ' + l.name + ' (' + Mission.themeName(l.theme) + ')'
      sel.appendChild(o)
    })
    sel.addEventListener('change', function() { $('new-seed').value = LEVELS[this.value].seed })
    $('new-dice').addEventListener('click', function() { $('new-seed').value = Math.floor(Math.random() * 99999) + 1 })
    $('new-cancel').addEventListener('click', function() { $('dialog-new').hidden = true })
    $('new-create').addEventListener('click', function() {
      var kind = document.querySelector('input[name=newkind]:checked').value
      if(self.unsaved && !confirm('Discard unsaved changes to "' + self.info.name + '"?')) return
      self.snapshot()
      if(kind == 'blank') {
        var w = Math.max(24, Math.min(160, Number($('new-w').value) || 64))
        var h = Math.max(24, Math.min(160, Number($('new-h').value) || 64))
        self.loadMission(self.blankMission($('new-theme').value, w, h))
      } else {
        self.newFromTemplate(Number(sel.value), Number($('new-seed').value) || 1)
      }
      self.libraryId = null
      self.changed()
      self.unsaved = false
      self.renderLibrary()
      $('dialog-new').hidden = true
    })

    // play-test overlay
    $('play-restart').addEventListener('click', function() { self.sendPlaytest() })
    $('play-close').addEventListener('click', function() { self.stopPlay() })
    window.addEventListener('message', function(e) {
      if(e.data && e.data.type == 'lv-ready' && !$('play-overlay').hidden) self.sendPlaytest()
    })
  },
  fillForm: function() {
    var i = this.info
    $('f-name').value = i.name
    $('f-place').value = i.place
    $('f-theme').value = i.theme
    $('f-drain').value = i.drain
    $('f-par').value = i.par
    $('f-burst').value = i.turretBurst
    $('f-brief').value = i.briefing.join('\n')
    $('f-w').value = this.level.w
    $('f-h').value = this.level.h
  },
  openNewDialog: function() {
    $('new-seed').value = LEVELS[$('new-template').value].seed
    $('dialog-new').hidden = false
  },
  toast: function(text) {
    var t = $('toast')
    t.textContent = text
    t.hidden = false
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(function() { t.hidden = true }, 2200)
  },
  resizeMap: function(w, h) {
    w = Math.max(24, Math.min(160, w || this.level.w))
    h = Math.max(24, Math.min(160, h || this.level.h))
    if(w == this.level.w && h == this.level.h) return
    this.snapshot()
    var m = this.toMission(), tiles = []
    for(var ty = 0; ty < h; ty++) {
      for(var tx = 0; tx < w; tx++) tiles.push(tx < m.w && ty < m.h ? m.tiles.charAt(ty * m.w + tx) : TILE.GROUND)
    }
    m.w = w
    m.h = h
    m.tiles = tiles.join('')
    var inMap = function(p) { return p[0] < w && p[1] < h }
    m.blocks = m.blocks.filter(inMap)
    m.entities = m.entities.filter(function(e) { return e.tx < w && e.ty < h })
    m.spawn = [Math.min(m.spawn[0], w - 3), Math.min(m.spawn[1], h - 3)]
    this.loadMission(m, true)
    this.changed()
  },

  // ------------------------------------------------------------ play-test

  play: function() {
    this.validate()
    var errors = this.problems.filter(function(p) { return p.level == 'error' })
    if(errors.length && !confirm('This mission has problems:\n\n- ' + errors.map(function(p) { return p.text }).join('\n- ') + '\n\nPlay anyway?')) return
    this.playMission = this.toMission()
    $('play-title').textContent = 'Play-testing: ' + (this.info.name || 'mission').toUpperCase()
    $('play-overlay').hidden = false
    $('play-frame').src = 'index.html?playtest'
  },
  sendPlaytest: function() {
    var frame = $('play-frame')
    if(!frame.contentWindow) return
    frame.contentWindow.postMessage({ type: 'lv-mission', mission: this.playMission }, '*')
    frame.focus()
  },
  stopPlay: function() {
    $('play-overlay').hidden = true
    $('play-frame').src = 'about:blank'
    this.canvas.focus()
  },

  // ------------------------------------------------------------ view

  resizeCanvas: function() {
    var dpr = window.devicePixelRatio || 1
    var r = this.canvas.parentNode.getBoundingClientRect()
    this.dpr = dpr
    this.vw = r.width
    this.vh = r.height
    this.canvas.width = Math.round(r.width * dpr)
    this.canvas.height = Math.round(r.height * dpr)
    this.needsRender = true
  },
  fitView: function() {
    if(!this.vw) return
    var lv = this.level
    var z = Math.min(this.vw / (lv.w * TS), (this.vh - 30) / (lv.h * TS)) * 0.95
    this.cam.zoom = Math.max(0.1, Math.min(2, z))
    this.cam.x = lv.w * TS / 2 - this.vw / 2 / this.cam.zoom
    this.cam.y = lv.h * TS / 2 - (this.vh - 30) / 2 / this.cam.zoom
    this.needsRender = true
  },
  centerOn: function(tx, ty) {
    this.cam.zoom = Math.max(this.cam.zoom, 0.6)
    this.cam.x = (tx + 0.5) * TS - this.vw / 2 / this.cam.zoom
    this.cam.y = (ty + 0.5) * TS - this.vh / 2 / this.cam.zoom
    this.flash = { tx: tx, ty: ty, until: Date.now() + 1500 }
    this.needsRender = true
  },
  zoomAt: function(sx, sy, factor) {
    var w = this.screenToWorld(sx, sy)
    this.cam.zoom = Math.max(0.1, Math.min(3, this.cam.zoom * factor))
    this.cam.x = w.x - sx / this.cam.zoom
    this.cam.y = w.y - sy / this.cam.zoom
    this.needsRender = true
  },
  screenToWorld: function(sx, sy) {
    return { x: this.cam.x + sx / this.cam.zoom, y: this.cam.y + sy / this.cam.zoom }
  },
  eventPos: function(e) {
    var r = this.canvas.getBoundingClientRect()
    var sx = e.clientX - r.left, sy = e.clientY - r.top
    var w = this.screenToWorld(sx, sy)
    return { sx: sx, sy: sy, x: w.x, y: w.y, tx: Math.floor(w.x / TS), ty: Math.floor(w.y / TS) }
  },

  // ------------------------------------------------------------ input

  bindCanvas: function() {
    var self = this, c = this.canvas
    c.tabIndex = 0
    c.addEventListener('contextmenu', function(e) { e.preventDefault() })
    c.addEventListener('wheel', function(e) {
      e.preventDefault()
      var p = self.eventPos(e)
      self.zoomAt(p.sx, p.sy, e.deltaY < 0 ? 1.15 : 1 / 1.15)
    }, { passive: false })
    c.addEventListener('mousedown', function(e) {
      c.focus()
      var p = self.eventPos(e)
      if(e.button == 1 || (e.button == 0 && self.spaceDown)) {
        e.preventDefault()
        self.drag = { mode: 'pan', sx: p.sx, sy: p.sy, cx: self.cam.x, cy: self.cam.y }
        return
      }
      self.pointerDown(p, e.button == 2)
    })
    window.addEventListener('mousemove', function(e) {
      var p = self.eventPos(e)
      var inside = p.sx >= 0 && p.sy >= 0 && p.sx < self.vw && p.sy < self.vh
      self.hover = inside ? p : null
      if(self.drag && self.drag.mode == 'pan') {
        self.cam.x = self.drag.cx - (p.sx - self.drag.sx) / self.cam.zoom
        self.cam.y = self.drag.cy - (p.sy - self.drag.sy) / self.cam.zoom
      } else if(self.drag) {
        self.pointerMove(p)
      }
      self.updateStatus()
      self.needsRender = true
    })
    window.addEventListener('mouseup', function(e) {
      if(!self.drag) return
      var d = self.drag
      self.drag = null
      if(d.mode != 'pan') self.pointerUp(self.eventPos(e), d)
      self.needsRender = true
    })
    c.addEventListener('mouseleave', function() {
      self.hover = null
      self.needsRender = true
    })
  },
  bindKeys: function() {
    var self = this
    var typing = function(e) {
      var t = e.target.tagName
      return t == 'INPUT' || t == 'TEXTAREA' || t == 'SELECT'
    }
    window.addEventListener('keydown', function(e) {
      if(!$('play-overlay').hidden) {
        if(e.key == 'Escape') self.stopPlay()
        return
      }
      if(e.key == 'F5') {
        e.preventDefault()
        self.play()
        return
      }
      if(e.ctrlKey || e.metaKey) {
        var k = e.key.toLowerCase()
        if(k == 'z' && !e.shiftKey) { e.preventDefault(); self.undo() }
        else if(k == 'y' || (k == 'z' && e.shiftKey)) { e.preventDefault(); self.redo() }
        else if(k == 's') { e.preventDefault(); self.save() }
        return
      }
      if(typing(e)) return
      if(e.key == ' ') {
        self.spaceDown = true
        e.preventDefault()
        return
      }
      if(e.key == 'Delete' || e.key == 'Backspace') {
        self.deleteSelected()
        return
      }
      if(e.key == 'h' || e.key == 'H') {
        self.fitView()
        return
      }
      var pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
      if(pan) {
        e.preventDefault()
        self.cam.x += pan[0] * 200 / self.cam.zoom
        self.cam.y += pan[1] * 200 / self.cam.zoom
        self.needsRender = true
        return
      }
      for(var i = 0; i < EDITOR_TOOLS.length; i++) {
        if(EDITOR_TOOLS[i].key == e.key.toLowerCase()) {
          self.setTool(EDITOR_TOOLS[i].id)
          return
        }
      }
    })
    window.addEventListener('keyup', function(e) {
      if(e.key == ' ') self.spaceDown = false
    })
    window.addEventListener('beforeunload', function() { self.saveDraft() })
  },

  pointerDown: function(p, secondary) {
    var t = this.currentTool(), lv = this.level
    // right button erases with object tools and paints empty ground with terrain tools
    if(secondary && t.tile === undefined && t.id != 'block') t = this.toolButtons.erase.tool
    this.drag = { mode: 'tool', tool: t, secondary: secondary, start: p, last: p, moved: false }

    if(t.id == 'select') {
      var hit = this.pick(p.x, p.y)
      this.selected = hit
      this.drag.target = hit
      this.renderSelected()
      return
    }
    if(t.id == 'stamp') {
      this.stampAt(p.tx, p.ty)
      this.drag = null
      return
    }
    if(!lv.inside(p.tx, p.ty)) {
      this.drag = null
      return
    }
    this.snapshot()
    if(t.id == 'spawn') {
      this.setSpawn(p.tx, p.ty)
      this.drag = null
      return
    }
    if(t.entity) {
      this.placeEntity(t, p.tx, p.ty)
      this.drag = null
      return
    }
    if(t.tile !== undefined && this.shape != 'brush') return // rectangle applied on release
    this.strokeTo(p, p)
  },
  pointerMove: function(p) {
    var d = this.drag
    if(d.tool.id == 'select') {
      if(!d.target || (p.tx == d.last.tx && p.ty == d.last.ty)) return
      if(!d.moved) this.snapshot()
      d.moved = true
      this.moveSelected(p.tx, p.ty)
      d.last = p
      return
    }
    if(d.tool.tile !== undefined && this.shape != 'brush') {
      d.last = p
      return
    }
    if(p.tx == d.last.tx && p.ty == d.last.ty) return
    this.strokeTo(d.last, p)
    d.last = p
  },
  pointerUp: function(p, d) {
    if(d.tool.tile !== undefined && this.shape != 'brush') {
      var tile = d.secondary ? TILE.GROUND : d.tool.tile
      var x0 = Math.min(d.start.tx, p.tx), x1 = Math.max(d.start.tx, p.tx)
      var y0 = Math.min(d.start.ty, p.ty), y1 = Math.max(d.start.ty, p.ty)
      for(var ty = y0; ty <= y1; ty++) {
        for(var tx = x0; tx <= x1; tx++) {
          if(this.shape == 'outline' && tx != x0 && tx != x1 && ty != y0 && ty != y1) continue
          this.setTile(tx, ty, tile)
        }
      }
      this.changed(x0, y0, x1, y1)
    }
  },
  // apply the brush along a line of tiles
  strokeTo: function(a, b) {
    var steps = Math.max(Math.abs(b.tx - a.tx), Math.abs(b.ty - a.ty), 1)
    var d = this.drag, n = this.brush, off = Math.floor((n - 1) / 2)
    for(var s = 0; s <= steps; s++) {
      var cx = Math.round(a.tx + (b.tx - a.tx) * s / steps), cy = Math.round(a.ty + (b.ty - a.ty) * s / steps)
      for(var dy = 0; dy < n; dy++) {
        for(var dx = 0; dx < n; dx++) this.brushTile(d.tool, d.secondary, cx - off + dx, cy - off + dy)
      }
    }
    this.changed(Math.min(a.tx, b.tx) - n, Math.min(a.ty, b.ty) - n, Math.max(a.tx, b.tx) + n, Math.max(a.ty, b.ty) + n)
  },
  brushTile: function(tool, secondary, tx, ty) {
    var lv = this.level
    if(!lv.inside(tx, ty)) return
    var i = ty * lv.w + tx
    if(tool.tile !== undefined) {
      this.setTile(tx, ty, secondary ? TILE.GROUND : tool.tile)
    } else if(tool.id == 'block') {
      if(secondary) delete lv.blocks[i]
      else {
        lv.tiles[i] = TILE.FLOOR
        if(!lv.blocks[i]) lv.addBlock(tx, ty)
      }
    } else if(tool.id == 'erase') {
      delete lv.blocks[i]
      this.entities = this.entities.filter(function(e) { return e.tx != tx || e.ty != ty })
      if(this.selected && this.selected != 'spawn' && this.entities.indexOf(this.selected) < 0) {
        this.selected = null
        this.renderSelected()
      }
    }
  },
  setTile: function(tx, ty, tile) {
    var lv = this.level
    if(!lv.inside(tx, ty)) return
    var i = ty * lv.w + tx
    lv.tiles[i] = tile
    if(tile != TILE.FLOOR) delete lv.blocks[i]
  },
  setSpawn: function(tx, ty) {
    this.level.spawnTile = { tx: tx, ty: ty }
    this.level.spawn = { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS }
    this.changed()
  },
  placeEntity: function(tool, tx, ty) {
    this.entities = this.entities.filter(function(e) { return e.tx != tx || e.ty != ty })
    var e = { type: tool.entity, tx: tx, ty: ty }
    if(tool.kind) e.kind = tool.kind
    if(tool.remote) e.remote = true
    this.entities.push(e)
    this.selected = e
    this.renderSelected()
    this.changed()
  },
  stampAt: function(tx, ty) {
    var lv = this.level
    var cols = Math.max(1, Math.min(8, Number($('stamp-cols').value) || 2))
    var rows = Math.max(1, Math.min(8, Number($('stamp-rows').value) || 2))
    var W = cols * CELL + 1, H = rows * CELL + 1
    if(W > lv.w || H > lv.h) {
      this.toast('The base does not fit on this map')
      return
    }
    var ox = Math.max(0, Math.min(lv.w - W, tx)), oy = Math.max(0, Math.min(lv.h - H, ty))
    this.snapshot()
    lv.rng = new Rng(Date.now() & 0xffffff)
    lv.buildInstallation({ cols: cols, rows: rows, entrances: 2, blockChance: Number($('stamp-blocks').value), empty: true, noMargin: true }, 0, ox, oy)
    for(var y = oy; y < oy + H; y++) {
      for(var x = ox; x < ox + W; x++) {
        if(lv.get(x, y) != TILE.FLOOR) delete lv.blocks[y * lv.w + x]
      }
    }
    this.changed(ox, oy, ox + W, oy + H)
  },
  // entity (or 'spawn') under a world position
  pick: function(x, y) {
    var best = null, bestD = 1e9
    for(var i = 0; i < this.entities.length; i++) {
      var e = this.entities[i]
      var d = Math.hypot((e.tx + 0.5) * TS - x, (e.ty + 0.5) * TS - y)
      if(d < Math.max(16, ENTITY_INFO[e.type].r) && d < bestD) {
        best = e
        bestD = d
      }
    }
    var sp = this.level.spawnTile
    if(Math.hypot((sp.tx + 0.5) * TS - x, (sp.ty + 0.5) * TS - y) < Math.min(30, bestD)) best = 'spawn'
    return best
  },
  moveSelected: function(tx, ty) {
    if(!this.level.inside(tx, ty)) return
    if(this.selected == 'spawn') this.setSpawn(tx, ty)
    else if(this.selected) {
      this.selected.tx = tx
      this.selected.ty = ty
      this.changed()
    }
    this.renderSelected()
  },
  deleteSelected: function() {
    if(!this.selected || this.selected == 'spawn') return
    this.snapshot()
    var sel = this.selected
    this.entities = this.entities.filter(function(e) { return e != sel })
    this.selected = null
    this.renderSelected()
    this.changed()
  },
  renderSelected: function() {
    var box = $('selected'), e = this.selected, self = this
    box.innerHTML = ''
    if(!e) {
      box.className = 'muted'
      box.textContent = 'Nothing selected. Use the select tool (V).'
      return
    }
    box.className = ''
    var line = function(html) {
      var d = document.createElement('div')
      d.className = 'props-line'
      d.innerHTML = html
      box.appendChild(d)
      return d
    }
    if(e == 'spawn') {
      var sp = this.level.spawnTile
      line('<b>Landing zone</b> at ' + sp.tx + ', ' + sp.ty)
      line('<span class="muted">The warp gate opens here when every target is destroyed.</span>')
      return
    }
    line('<b>' + ENTITY_INFO[e.type].name + '</b> at ' + e.tx + ', ' + e.ty)
    if(e.type == 'generator') {
      var l = line('<label><input type="checkbox"> remote: shields the Mothercore instead of the cores in its base</label>')
      var cb = l.querySelector('input')
      cb.checked = !!e.remote
      cb.addEventListener('change', function() {
        self.snapshot()
        e.remote = cb.checked
        self.changed()
      })
    }
    if(e.type == 'pickup') {
      var p = line('<label>Contents <select><option value="E">Energy +35</option><option value="P">Cannon upgrade</option><option value="M">Missiles +4</option></select></label>')
      var s = p.querySelector('select')
      s.value = e.kind || 'E'
      s.addEventListener('change', function() {
        self.snapshot()
        e.kind = s.value
        self.changed()
      })
    }
    var del = document.createElement('button')
    del.textContent = 'Delete'
    del.style.marginTop = '8px'
    del.addEventListener('click', function() { self.deleteSelected() })
    box.appendChild(del)
  },
  updateStatus: function() {
    var h = this.hover, lv = this.level, t = this.currentTool()
    var names = ['ground', 'rock', 'base floor', 'wall']
    if(THEMES[this.info.theme].space) names = ['space', 'asteroid', 'base floor', 'wall']
    var s = ''
    if(h && lv.inside(h.tx, h.ty)) {
      s = 'tile ' + h.tx + ',' + h.ty + '  ' + names[lv.get(h.tx, h.ty)] + (lv.blocks[h.ty * lv.w + h.tx] ? ' + block' : '') + '   '
    }
    s += 'zoom ' + Math.round(this.cam.zoom * 100) + '%   ' + lv.w + 'x' + lv.h + '   ' + this.entities.length + ' objects   '
    s += 'tool: ' + t.label
    $('status').textContent = s
  },

  // ------------------------------------------------------------ drawing

  tileColor: function(tile) {
    var th = THEMES[this.info.theme]
    var rgb = function(c, f) {
      return 'rgb(' + Math.round(c[0] * f) + ',' + Math.round(c[1] * f) + ',' + Math.round(c[2] * f) + ')'
    }
    if(tile == TILE.GROUND) {
      if(th.space) return null
      return rgb([(th.groundA[0] + th.groundB[0]) / 2, (th.groundA[1] + th.groundB[1]) / 2, (th.groundA[2] + th.groundB[2]) / 2], 0.9)
    }
    if(tile == TILE.ROCK) return rgb(th.rockB, 0.7)
    if(tile == TILE.FLOOR) return rgb(th.metal, 1)
    return rgb(th.wall, 0.8)
  },
  frame: function() {
    var now = Date.now()
    if(this.validateAt && now > this.validateAt) {
      this.validateAt = 0
      this.validate()
    }
    if(this.draftAt && now > this.draftAt) {
      this.draftAt = 0
      this.saveDraft()
    }
    // render the real terrain for visible chunks, one per frame, once editing pauses
    if(this.preview && now - this.lastEdit > 350 && !this.drag) {
      var r = this.visibleChunks()
      search:
      for(var cy = r.cy0; cy <= r.cy1; cy++) {
        for(var cx = r.cx0; cx <= r.cx1; cx++) {
          if(!this.terrain.chunks[cx + ',' + cy]) {
            this.terrain.getChunk(cx, cy)
            this.needsRender = true
            break search
          }
        }
      }
    }
    if(this.flash && now > this.flash.until) {
      this.flash = null
      this.needsRender = true
    }
    if(this.needsRender || this.flash) {
      this.needsRender = false
      this.render()
    }
  },
  visibleChunks: function() {
    var c = this.cam, lv = this.level, per = CHUNK
    return {
      cx0: Math.max(0, Math.floor(c.x / per)), cy0: Math.max(0, Math.floor(c.y / per)),
      cx1: Math.min(this.terrain.cols - 1, Math.floor((c.x + this.vw / c.zoom) / per)),
      cy1: Math.min(this.terrain.rows - 1, Math.floor((c.y + this.vh / c.zoom) / per))
    }
  },
  render: function() {
    var ctx = this.ctx, lv = this.level, c = this.cam, th = THEMES[this.info.theme]
    var z = c.zoom * this.dpr
    this.syncInstallations()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#08090d'
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(z, 0, 0, z, -c.x * z, -c.y * z)
    ctx.imageSmoothingEnabled = c.zoom < 1

    var tx0 = Math.max(0, Math.floor(c.x / TS)), ty0 = Math.max(0, Math.floor(c.y / TS))
    var tx1 = Math.min(lv.w - 1, Math.floor((c.x + this.vw / c.zoom) / TS))
    var ty1 = Math.min(lv.h - 1, Math.floor((c.y + this.vh / c.zoom) / TS))

    // map background (space shows a starry void)
    ctx.fillStyle = th.space ? '#05070f' : '#000'
    ctx.fillRect(0, 0, lv.w * TS, lv.h * TS)
    if(th.space) this.drawStars(ctx, tx0, ty0, tx1, ty1)

    // schematic tiles, merged into runs
    for(var ty = ty0; ty <= ty1; ty++) {
      var run = tx0, t0 = lv.tiles[ty * lv.w + tx0]
      for(var tx = tx0 + 1; tx <= tx1 + 1; tx++) {
        var t = tx <= tx1 ? lv.tiles[ty * lv.w + tx] : -1
        if(t == t0) continue
        var col = this.tileColor(t0)
        if(col) {
          ctx.fillStyle = col
          ctx.fillRect(run * TS, ty * TS, (tx - run) * TS + 0.5, TS + 0.5)
        }
        run = tx
        t0 = t
      }
    }
    // real terrain where it is rendered and up to date
    if(this.preview) {
      var r = this.visibleChunks()
      for(var cy = r.cy0; cy <= r.cy1; cy++) {
        for(var cx = r.cx0; cx <= r.cx1; cx++) {
          var chunk = this.terrain.chunks[cx + ',' + cy]
          if(chunk) ctx.drawImage(chunk, cx * CHUNK, cy * CHUNK)
        }
      }
    }
    // destructible blocks
    for(var key in lv.blocks) {
      var b = lv.blocks[key]
      if(b.tx >= tx0 && b.tx <= tx1 && b.ty >= ty0 && b.ty <= ty1) ctx.drawImage(Gfx.sprites.block, b.tx * TS, b.ty * TS)
    }
    // grid
    if(this.grid && c.zoom >= 0.35) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1 / c.zoom
      ctx.beginPath()
      for(tx = tx0; tx <= tx1 + 1; tx++) {
        ctx.moveTo(tx * TS, ty0 * TS)
        ctx.lineTo(tx * TS, (ty1 + 1) * TS)
      }
      for(ty = ty0; ty <= ty1 + 1; ty++) {
        ctx.moveTo(tx0 * TS, ty * TS)
        ctx.lineTo((tx1 + 1) * TS, ty * TS)
      }
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255,176,74,0.6)'
    ctx.lineWidth = 2 / c.zoom
    ctx.strokeRect(0, 0, lv.w * TS, lv.h * TS)

    this.drawShieldLinks(ctx)
    this.drawEntities(ctx)
    this.drawSpawn(ctx)
    this.drawProblems(ctx)
    this.drawToolPreview(ctx)
    this.updateStatus()
  },
  drawStars: function(ctx, tx0, ty0, tx1, ty1) {
    ctx.fillStyle = 'rgba(220,230,255,0.6)'
    for(var ty = ty0; ty <= ty1; ty++) {
      for(var tx = tx0; tx <= tx1; tx++) {
        var h = Noise.hash(tx, ty, 9)
        if(h < 0.3) ctx.fillRect(tx * TS + h * 90 % 30, ty * TS + h * 170 % 30, 2, 2)
      }
    }
  },
  drawShieldLinks: function(ctx) {
    var lv = this.level, self = this
    ctx.save()
    ctx.setLineDash([10, 8])
    ctx.lineWidth = 2.5
    this.entities.forEach(function(g) {
      if(g.type != 'generator') return
      ctx.strokeStyle = g.remote ? 'rgba(190,120,255,0.75)' : 'rgba(90,190,255,0.75)'
      Mission.shieldTargets(lv, self.entities, g).forEach(function(t) {
        ctx.beginPath()
        ctx.moveTo((g.tx + 0.5) * TS, (g.ty + 0.5) * TS)
        ctx.lineTo((t.tx + 0.5) * TS, (t.ty + 0.5) * TS)
        ctx.stroke()
      })
    })
    ctx.restore()
  },
  drawEntity: function(ctx, e, alpha) {
    var x = (e.tx + 0.5) * TS, y = (e.ty + 0.5) * TS
    var spr = Gfx.sprites[e.type == 'pickup' ? 'pickup' + (e.kind || 'E') : ENTITY_INFO[e.type].sprite]
    ctx.globalAlpha = alpha || 1
    ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2)
    if(e.type == 'turret') ctx.drawImage(Gfx.sprites.turretGun, x - 24, y - 24)
    if(e.type == 'core' || e.type == 'boss') Gfx.drawGlow(ctx, x, y, e.type == 'boss' ? 18 : 14, e.type == 'boss' ? [255, 40, 70] : [255, 160, 50], alpha || 1)
    if(e.type == 'generator' && e.remote) this.drawRemoteBadge(ctx, x + 14, y - 14)
    ctx.globalAlpha = 1
  },
  drawEntities: function(ctx) {
    for(var i = 0; i < this.entities.length; i++) this.drawEntity(ctx, this.entities[i])
    var s = this.selected
    if(s && s != 'spawn') {
      ctx.strokeStyle = '#ffb04a'
      ctx.lineWidth = 2 / this.cam.zoom
      Gfx.circle(ctx, (s.tx + 0.5) * TS, (s.ty + 0.5) * TS, ENTITY_INFO[s.type].r + 6)
      ctx.stroke()
    }
  },
  drawSpawn: function(ctx) {
    var sp = this.level.spawnTile, x = (sp.tx + 0.5) * TS, y = (sp.ty + 0.5) * TS
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    Gfx.circle(ctx, x, y, 30)
    ctx.fill()
    this.drawSpawnIcon(ctx, x, y, 26)
    if(this.selected == 'spawn') {
      ctx.strokeStyle = '#ffb04a'
      ctx.lineWidth = 2 / this.cam.zoom
      Gfx.circle(ctx, x, y, 36)
      ctx.stroke()
    }
  },
  drawProblems: function(ctx) {
    for(var i = 0; i < this.problems.length; i++) {
      var p = this.problems[i]
      if(p.tx === undefined) continue
      var x = (p.tx + 0.5) * TS, y = (p.ty + 0.5) * TS
      ctx.strokeStyle = p.level == 'error' ? '#ff6a5a' : '#ffd27a'
      ctx.lineWidth = 3 / this.cam.zoom
      ctx.strokeRect(x - 20, y - 20, 40, 40)
    }
    if(this.flash) {
      var fx = (this.flash.tx + 0.5) * TS, fy = (this.flash.ty + 0.5) * TS
      ctx.strokeStyle = Math.floor(Date.now() / 150) % 2 ? '#fff' : '#ff6a5a'
      ctx.lineWidth = 4 / this.cam.zoom
      Gfx.circle(ctx, fx, fy, 44)
      ctx.stroke()
    }
  },
  drawToolPreview: function(ctx) {
    var h = this.hover, t = this.currentTool(), lv = this.level, d = this.drag
    if(!h || (d && d.mode == 'pan')) return
    ctx.lineWidth = 2 / this.cam.zoom
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    if(t.tile !== undefined && this.shape != 'brush' && d && d.mode == 'tool') {
      var x0 = Math.min(d.start.tx, h.tx), x1 = Math.max(d.start.tx, h.tx)
      var y0 = Math.min(d.start.ty, h.ty), y1 = Math.max(d.start.ty, h.ty)
      ctx.fillStyle = 'rgba(255,176,74,0.25)'
      ctx.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS)
      ctx.strokeRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS)
    } else if(t.tile !== undefined || t.id == 'block' || t.id == 'erase') {
      var n = (t.tile !== undefined && this.shape != 'brush') ? 1 : this.brush, off = Math.floor((n - 1) / 2)
      ctx.strokeRect((h.tx - off) * TS, (h.ty - off) * TS, n * TS, n * TS)
    } else if(t.id == 'stamp') {
      var cols = Math.max(1, Math.min(8, Number($('stamp-cols').value) || 2))
      var rows = Math.max(1, Math.min(8, Number($('stamp-rows').value) || 2))
      var W = cols * CELL + 1, H = rows * CELL + 1
      var ox = Math.max(0, Math.min(lv.w - W, h.tx)), oy = Math.max(0, Math.min(lv.h - H, h.ty))
      ctx.fillStyle = 'rgba(120,200,255,0.15)'
      ctx.fillRect(ox * TS, oy * TS, W * TS, H * TS)
      ctx.strokeStyle = 'rgba(120,200,255,0.9)'
      ctx.beginPath()
      for(var c = 0; c <= cols; c++) {
        ctx.moveTo((ox + c * CELL + 0.5) * TS, (oy + 0.5) * TS)
        ctx.lineTo((ox + c * CELL + 0.5) * TS, (oy + H - 0.5) * TS)
      }
      for(var r = 0; r <= rows; r++) {
        ctx.moveTo((ox + 0.5) * TS, (oy + r * CELL + 0.5) * TS)
        ctx.lineTo((ox + W - 0.5) * TS, (oy + r * CELL + 0.5) * TS)
      }
      ctx.stroke()
    } else if(t.entity && lv.inside(h.tx, h.ty)) {
      this.drawEntity(ctx, { type: t.entity, tx: h.tx, ty: h.ty, kind: t.kind, remote: t.remote }, 0.55)
    } else if(t.id == 'spawn') {
      ctx.globalAlpha = 0.55
      this.drawSpawnIcon(ctx, (h.tx + 0.5) * TS, (h.ty + 0.5) * TS, 26)
      ctx.globalAlpha = 1
    }
  }
})
