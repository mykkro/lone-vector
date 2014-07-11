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
  renderBackground: function(ctx) {
    var size = 32
    var sx = Math.floor(this.x)
    var sy = Math.floor(this.y)
    var dx = Math.floor((this.x-sx)*32)
    var dy = Math.floor((this.y-sy)*32)
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        var xx = j + sx
        var yy = i + sy
        var cx = Math.floor(xx / 16)
        var cy = Math.floor(yy / 16)
        ctx.fillStyle = "#333"; 
        if((cx+cy)%2==0) {
          ctx.fillStyle="#111"
        }
        ctx.fillRect(j*size-dx,i*size-dy,size,size);
      }
    }
  },
  renderGrid: function(ctx) {
    var size = 32
    var sx = Math.floor(this.x)
    var sy = Math.floor(this.y)
    var dx = Math.floor((this.x-sx)*32)
    var dy = Math.floor((this.y-sy)*32)
    ctx.beginPath()
    for (var x = 0; x <= this.width*size; x += size) {
        ctx.moveTo(x-dx, 0-dy);
        ctx.lineTo(x-dx, this.height*size-dy);
    }

    for (var y = 0; y <= this.height*size; y += size) {
        ctx.moveTo(0-dx, y-dy);
        ctx.lineTo(this.width*size-dx, y-dy);
    }
    ctx.lineWidth = 0.5
    ctx.strokeStyle = "cyan";
    ctx.stroke();    
  },
  renderLayer: function(ctx, layer) {
    var size = 32
    var sx = Math.floor(this.x)
    var sy = Math.floor(this.y)
    var dx = Math.floor((this.x-sx)*32)
    var dy = Math.floor((this.y-sy)*32)
    console.log(this.x+","+this.y+","+sx+","+sy+","+dx+","+dy)
    ctx.save(); 
    ctx.translate(-dx, -dy);
    for(var i=0; i<this.height; i++) {
      for(var j=0; j<this.width; j++) {
        var xx = j + sx
        var yy = i + sy
        var cx = Math.floor(xx / 16)
        var cy = Math.floor(yy / 16)
        var x = ((xx % 16) + 16)%16
        var y = ((yy % 16) + 16)%16
        var chunk = this.cf.getChunk(cx, cy)
        var tile, tx, ty, texture
        if(chunk && (layer in chunk.layers)) {
            tile = chunk.layers[layer].getTile(x, y)
            chunk.layers[layer].renderTile(ctx, j, i, tile)
          }
        }
      }
      ctx.restore();
    }
})

