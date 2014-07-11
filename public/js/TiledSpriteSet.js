
var TiledSpriteSet = SpriteBase.extend({
    /* m*n grid */
    constructor: function(url, width, height, refx, refy, rows, cols, index) {
        this.base(url, width, height, refx, refy)
        this.rows = rows
        this.cols = cols
        this.index = index
    },
    render: function(ctx) {
        var w = this.width
        var h = this.height
        var ndx = this.index
        var xx = (ndx % this.cols) * w
        var yy = Math.floor(ndx / this.cols) * h
        ctx.drawImage(resources.get(this.url),
                      xx, 
                      yy,
                      w, h,
                      this.x - this.refx, 
                      this.y - this.refy,
                      w, h);
    }
})