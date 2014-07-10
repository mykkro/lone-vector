var ChunkLayer = Base.extend({
  constructor: function(chunk) {
    this.chunk = chunk
    this.tileSize = 32
  },
  getTile: function(x, y) {
    // override in subclass...
  },
  setTile: function(x, y, tile) {
    // override in subclass...
  },
  renderTile: function(ctx, j, i, tile) {
    // override in subclass...
  }
})
