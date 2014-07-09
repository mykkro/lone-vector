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
    if(chunk.loaded) {
      var regions = []
      for(key in chunk.layers) {
        var layer = chunk.layers[key]
        if(layer.changed) {
          console.log("Writing changed layer: "+x+","+y+","+key)
          regions.push({layer: key, tiles: layer.tiles})
          layer.changed = false
        }
      }
      console.log("Saving chunk "+x+","+y)
      this.socket.emit("chunk edit", {x:x, y:y, regions:regions})
    }
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
