// A cross-browser requestAnimationFrame
// See https://hacks.mozilla.org/2011/08/animating-with-javascript-from-setinterval-to-requestanimationframe/
var requestAnimFrame = (function(){
    return window.requestAnimationFrame       ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function(callback){
            window.setTimeout(callback, 1000 / 60);
        };
})();


var Chunk = Base.extend({
  constructor: function() {
    this.width = 16
    this.height = 16
    this.tiles = []      
    this.changed = false
  },
  fillRandomly: function() {
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        this.tiles.push(this.randomTile())
      }
    }
  },
  randomTile: function() {
    return {
      image: resources.get('images/scifi-tileset.png'),
      x: Math.floor(Math.random()*16),
      y: Math.floor(Math.random()*8*11)
    }
  },
  getTile: function(x, y) {
    return this.tiles[x + this.width*y]
  },
  setTile: function(x, y, tile) {
    this.tiles[x + this.width*y] = tile
    this.changed = true
  },
  render: function(ctx) {
    var size = 32
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        var ndx = i*this.width+j
        var tile = this.tiles[ndx]
        ctx.drawImage(tile.image, tile.x*size, tile.y*size, size, size, j*size, i*size, size, size)
      }
    }
  }
})

var ChunkFactory = Base.extend({
  constructor: function() {
    this.chunks = {}
  },
  getChunk: function(x, y) {
    var name = x+","+y
    return this.chunks[name]
  },
  loadChunk: function(x, y) {
    var name = x+","+y
    if(!this.getChunk(x, y)) {
      var chunk = new Chunk()
      chunk.fillRandomly()
      this.chunks[name] = chunk
    }
  },
  unloadChunk: function(x, y) {
    var name = x+","+y
    this.chunks[name] = null
    delete this.chunks[name]
  }
})

var GameMap = Base.extend({
  constructor: function() {
    this.cf = new ChunkFactory()
    this.x = 0
    this.y = 0
    this.width = 16
    this.height = 14
    this.backTile = {
      image: resources.get('images/scifi-tileset.png'),
      x: 2,
      y: 9
    }
  },
  preloadChunks: function() {
    this.cf.loadChunk(-1,-1)
    this.cf.loadChunk(-1,0)
    this.cf.loadChunk(-1,1)
    this.cf.loadChunk(0,-1)
    this.cf.loadChunk(0,0)
    this.cf.loadChunk(0,1)
    this.cf.loadChunk(1,-1)
    this.cf.loadChunk(1,0)
    this.cf.loadChunk(1,1)
  },
  put: function(x, y, tile) {
      var cx = Math.floor(x / 16)
      var cy = Math.floor(y / 16)
      var x = ((x % 16) + 16)%16
      var y = ((y % 16) + 16)%16
      var chunk = this.cf.getChunk(cx, cy)
      chunk.setTile(x, y, tile)
  },
  render: function(ctx) {
    var size = 32
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        var xx = j + this.x
        var yy = i + this.y
        var cx = Math.floor(xx / 16)
        var cy = Math.floor(yy / 16)
        var x = ((xx % 16) + 16)%16
        var y = ((yy % 16) + 16)%16
        var chunk = this.cf.getChunk(cx, cy)
        var tile
        if(chunk) {
          tile = chunk.getTile(x, y)
        } else {
          tile = this.backTile
        }
        ctx.drawImage(tile.image, tile.x*size, tile.y*size, size, size, j*size, i*size, size, size)
      }
    }
  }
})





// Update game objects

var App = Base.extend({
  constructor: function() {
    this.gameTime = 0
    this.lastTime = 0
    this.ctx = null
  },
  // run once - load resources, create GUI...
  init: function() {
    console.log("App initializing...")

    this.gm = new GameMap()
    this.gm.preloadChunks()

      // Create the canvas
  	var canvas = document.createElement("canvas");
  	this.ctx = canvas.getContext("2d");
  	canvas.width = 512;
  	canvas.height = 512;
  	document.body.appendChild(canvas);

    var self = this
    $(canvas).click(function(eventObject) {
      var mouseX = eventObject.pageX - this.offsetLeft;
      var mouseY = eventObject.pageY - this.offsetTop;
      self.paint(mouseX, mouseY)
    });
    $(canvas).mousemove(function(eventObject){
     if(eventObject.which==1)
     {
      var mouseX = eventObject.pageX - this.offsetLeft;
      var mouseY = eventObject.pageY - this.offsetTop;
      self.paint(mouseX, mouseY)
     }
    });
    lastTime = Date.now();
    this.main();

  },
  paint: function(mouseX, mouseY) {
    var x = Math.floor(mouseX / 32) + this.gm.x
    var y = Math.floor(mouseY / 32) + this.gm.y
    var tile = this.gm.backTile
    this.gm.put(x, y, tile)
  },
  main: function() {
    var now = Date.now();
    var dt = (now - this.lastTime) / 1000.0;

    this.update(dt);
    this.render();

    this.lastTime = now;
    var self = this
    var foo = function() {
      self.main()
    }
    requestAnimFrame(foo);
  },
  update: function(dt) {
    this.gameTime += dt;

    this.handleInput(dt);
  },

  // Draw everything
  render: function() {
      //console.log("Rendering...")
      this.ctx.clearRect ( 0 , 0 , 512 , 512 );
      this.gm.render(this.ctx)
  },
  handleInput: function(dt) {
    if(input.isDown('DOWN') || input.isDown('s')) {
        //console.log("Down")
        this.gm.y++
    }

    if(input.isDown('UP') || input.isDown('w')) {
        //console.log("Up")
        this.gm.y--
    }

    if(input.isDown('LEFT') || input.isDown('a')) {
        //console.log("Left")
        this.gm.x--
    }

    if(input.isDown('RIGHT') || input.isDown('d')) {
        //console.log("Right")
        this.gm.x++
    }

    if(input.isDown('SPACE')) {
        //console.log("Space")
    }
  }




})