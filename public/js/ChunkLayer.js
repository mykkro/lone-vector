var ChunkLayer = Base.extend({
  constructor: function(chunk, data) {
    if(!data) {
      data = {}
    }
    this.texture = data.texture || 'images/scifi-tileset.png'
    this.empty = data.empty || 13 + 9*16
    this.tiles = data.tiles || []
    this.chunk = chunk
    this.textureRes = resources.get(this.texture)
  },
  clear: function() {
    var size = this.chunk.size
    var empty = this.empty
    this.tiles = Array.apply(null, new Array(size*size)).map(Number.prototype.valueOf,empty)
  }
})
