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
    this.changed = false
  },
  clear: function() {
    var size = this.chunk.size
    var empty = this.empty
    this.tiles = Array.apply(null, new Array(size*size)).map(Number.prototype.valueOf,empty)
  },
  getTile: function(x, y) {
    return this.tiles[x + this.chunk.size*y]
  },
  setTile: function(x, y, tile) {
    this.tiles[x + this.chunk.size*y] = tile
    this.changed = true
  },
  renderTile: function(ctx, j, i, tile) {
      var size = 32
      var texture = this.textureRes
      var tx = tile % 16
      var ty = Math.floor(tile / 16)
      ctx.drawImage(texture, tx*size, ty*size, size, size, j*size, i*size, size, size)
  }
})
