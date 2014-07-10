var TiledChunkLayer = ChunkLayer.extend({
  constructor: function(chunk, data) {
  	this.base(chunk)
    if(!data) {
      data = {}
    }
    this.texture = data.texture || 'images/scifi-tileset.png'
    this.empty = data.empty || 13 + 9*16
    if(data.tiles) {
    	this.tiles = data.tiles
    } else {
	    var size = this.chunk.size
	    var empty = this.empty
	    this.tiles = Array.apply(null, new Array(size*size)).map(Number.prototype.valueOf,empty)
    }
    this.textureRes = resources.get(this.texture)
    this.changed = false
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
