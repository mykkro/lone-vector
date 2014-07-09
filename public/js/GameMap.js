var GameMap = Base.extend({
  constructor: function(socket) {
    this.cf = new ChunkFactory(socket)
    this.x = 0
    this.y = 0
    this.width = 16
    this.height = 14
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
  put: function(layer, x, y, tile) {
      var cx = Math.floor(x / 16)
      var cy = Math.floor(y / 16)
      var x = ((x % 16) + 16)%16
      var y = ((y % 16) + 16)%16
      var chunk = this.cf.getChunk(cx, cy)
      chunk.setTile(layer, x, y, tile)
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
        ctx.fillStyle = "#333"; 
        if((cx+cy)%2==0) {
          ctx.fillStyle="#111"
        }
        ctx.fillRect(j*size,i*size,size,size);
        var chunk = this.cf.getChunk(cx, cy)
        var tile, tx, ty, texture
        if(chunk) {
          // ground layer...
          if(chunk.layers.ground) {
            tile = chunk.layers.ground.getTile(x, y)
            chunk.layers.ground.renderTile(ctx, j, i, tile)
          }
          // obstacles...
          if(chunk.layers.obstacles) {
            tile = chunk.layers.obstacles.getTile(x, y)
            chunk.layers.obstacles.renderTile(ctx, j, i, tile)
          }
          // overlay...
          if(chunk.layers.overlay) {
            tile = chunk.layers.overlay.getTile(x, y)
            chunk.layers.overlay.renderTile(ctx, j, i, tile)
          }
        }
      }
    }
  }
})

