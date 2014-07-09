var Chunk = Base.extend({
  constructor: function(x, y) {
    this.x = x
    this.y = y
    this.size = 16
    this.layers = {
      ground: new ChunkLayer(this),
      obstacles: new ChunkLayer(this),
      overlay: new ChunkLayer(this)
    }      
    this.layers.ground.clear()
    this.layers.obstacles.clear()
    this.layers.overlay.clear()
    this.loaded = false
  },
  load: function() {
    console.log("Loading chunk "+this.x+","+this.y)
    var self = this
    $.getJSON("chunks/"+this.x+","+this.y+".json").done(function(data) {
      console.log("Chunk loaded: ", data)
      self.layers = data.layers
      self.layers.ground = new ChunkLayer(self, self.layers.ground)
      self.layers.obstacles = new ChunkLayer(self, self.layers.obstacles)
      self.layers.overlay = new ChunkLayer(self, self.layers.overlay)
      self.loaded = true
    })
  },
  getTile: function(layer, x, y) {
    return this.layers[layer].getTile(x, y)
  },
  setTile: function(layer, x, y, tile) {
    this.layers[layer].setTile(x, y, tile)
    this.changed = true
  }
})
