var Chunk = Base.extend({
  constructor: function(x, y) {
    this.x = x
    this.y = y
    this.size = 16
    this.layers = {
      ground: new ChunkLayer(this)
    }      
    this.layers.ground.clear()
    this.loaded = false
  },
  load: function() {
    console.log("Loading chunk "+this.x+","+this.y)
    var self = this
    $.getJSON("chunks/"+this.x+","+this.y+".json").done(function(data) {
      console.log("Chunk loaded: ", data)
      self.layers = data.layers
      self.layers.ground = new ChunkLayer(self, self.layers.ground)
      self.loaded = true
    })
  },
  getTile: function(x, y) {
    return this.layers.ground.tiles[x + this.size*y]
  },
  setTile: function(x, y, tile) {
    this.layers.ground.tiles[x + this.size*y] = tile
    this.changed = true
  }
})
