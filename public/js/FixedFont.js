
var FixedFont = SpriteBase.extend({
    /* 3*3 grid */
    /* angle in degrees */
    constructor: function(url, width, height) {
        this.base(url, width, height, 0, 0)
    },
    renderChar: function(ctx, x, y, char) {
        var w = this.width
        var h = this.height
        var ndx = char.charCodeAt() - 33
        if(ndx>=0) {
          var xx = (ndx % 16) * w
          var yy = Math.floor(ndx / 16) * h
          ctx.drawImage(resources.get(this.url),
                        xx, 
                        yy,
                        w, h,
                        x, 
                        y,
                        w, h);
        }
    },
    renderText: function(ctx, x, y, text) {
      for(var i=0; i<text.length; i++) {
        this.renderChar(ctx, x+i*this.width, y, text.charAt(i))
      }
    }
})