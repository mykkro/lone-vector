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
  constructor: function(x, y) {
    this.x = x
    this.y = y
    this.width = 16
    this.height = 16
    this.tiles = []      
    this.changed = false
    this.emptyTile = {
      image: resources.get('images/scifi-tileset.png'),
      x: 13,
      y: 9
    }
    this.fillEmpty()
    this.loaded = false
  },
  fillRandomly: function() {
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        this.tiles.push(this.randomTile())
      }
    }
  },
  fillEmpty: function() {
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        this.tiles.push(this.emptyTile)
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
  load: function() {
    console.log("Loading chunk "+this.x+","+this.y)
    var self = this
    $.getJSON("chunks/"+this.x+","+this.y+".json").done(function(data) {
      console.log("Chunk loaded: ", data)
      for(var i=0; i<data.tiles.length; i++) {
        var pos = data.tiles[i]
        var xx = pos % 16
        var yy = Math.floor(pos / 16)
        self.tiles[i].x = xx
        self.tiles[i].y = yy
      }
      self.loaded = true
    })
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
  constructor: function(socket) {
    this.chunks = {}
    this.socket = socket
  },
  getChunk: function(x, y) {
    var name = x+","+y
    return this.chunks[name]
  },
  loadChunk: function(x, y) {
    var name = x+","+y
    if(!this.getChunk(x, y)) {
      var chunk = new Chunk(x, y)
      this.chunks[name] = chunk
      chunk.load()
    }
  },
  unloadChunk: function(x, y) {
    var name = x+","+y
    this.chunks[name] = null
    delete this.chunks[name]
  },
  preloadChunks: function(x, y, unloadDistance) {
    //console.log("Preloading chunks: "+x+","+y)
    if(unloadDistance) {
      for(var key in this.chunks) {
        var pos = key.split(",")
        var xx = parseInt(pos[0])
        var yy = parseInt(pos[1])
        var chunk = this.chunks[key]
        if(Math.abs(xx-x)>unloadDistance || Math.abs(yy-y)>unloadDistance) {
          if(chunk.changed) {
            this.saveChunk(xx, yy, chunk)
            chunk.changed = false
          }
          this.unloadChunk(xx, yy)
        }
      }
    }
    this.loadChunk(x-1,y-1)
    this.loadChunk(x-1,y)
    this.loadChunk(x-1,y+1)
    this.loadChunk(x,y-1)
    this.loadChunk(x,y)
    this.loadChunk(x,y+1)
    this.loadChunk(x+1,y-1)
    this.loadChunk(x+1,y)
    this.loadChunk(x+1,y+1)
    var cnt = 0
    for(var key in this.chunks) {
      cnt++
    }
    //console.log("Total chunks: "+cnt)
  },
  saveChunk: function(x, y, chunk) {
    //if(chunk.loaded) {
      var tiles = []
      for(var i=0; i<chunk.tiles.length; i++) {
        tiles.push(chunk.tiles[i].x + 16*chunk.tiles[i].y)
      }
      var regions = [{ tiles: tiles }]
      console.log("Saving chunk "+x+","+y)
      this.socket.emit("chunk edit", {x:x, y:y, regions:regions})
    //}
  },
  saveChangedChunks: function() {
    for(var key in this.chunks) {
      var chunk = this.chunks[key]
      if(chunk.changed) {
        var pos = key.split(",")
        var xx = parseInt(pos[0])
        var yy = parseInt(pos[1])
        this.saveChunk(xx, yy, chunk)
        chunk.changed = false
      }
    }
  }
})

var GameMap = Base.extend({
  constructor: function(socket) {
    this.cf = new ChunkFactory(socket)
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
    var xx = Math.floor(this.x/16)
    var yy = Math.floor(this.y/16)
    this.cf.preloadChunks(xx, yy, 3)
  },
  saveChangedChunks: function() {
    console.log("Saving changed chunks...")
    this.cf.saveChangedChunks()
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
    this.frame = 0
  },
  // run once - load resources, create GUI...
  init: function() {
    console.log("App initializing...")

    this.socket = io();

    this.gm = new GameMap(this.socket)
    this.currentTile = this.gm.backTile

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

    $("#tileset").click(function(event) {
      var $this = $(this);
      var parentOffset = $this.parent().offset();
      var offset = $this.offset()
      var mouseX = event.pageX - parentOffset.left - offset.left;
      var mouseY = event.pageY - parentOffset.top - offset.top;     
      var px = Math.floor(mouseX/32)
      var py = Math.floor(mouseY/32)
      self.currentTile = {
        image: resources.get('images/scifi-tileset.png'),
        x: px,
        y: py
      }
      console.log(mouseX+","+mouseY+"  "+px+","+py)
    })


    this.socket.on('response', function(data){
      console.log(data);
    });
  /*
  $('#btn1').click(function(){
    socket.emit('chat message', {"foo":"bar"});
    return false;
  });
*/

    lastTime = Date.now();
    this.main();

  },
  paint: function(mouseX, mouseY) {
    var x = Math.floor(mouseX / 32) + this.gm.x
    var y = Math.floor(mouseY / 32) + this.gm.y
    this.gm.put(x, y, this.currentTile)
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
    if(this.frame % 30 == 0) {
      this.gm.preloadChunks()
    }
    if(this.frame % 3600 == 0) {
      this.gm.saveChangedChunks(this.socket)
    }
    this.frame++
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