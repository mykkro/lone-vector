
var RotatedSpriteSet = SpriteBase.extend({
    /* 6*6 grid */
    /* angle in degrees */
    constructor: function(url, width, height, refx, refy, angle) {
        this.base(url, width, height, refx, refy)
        this.angle = angle
    },
    render: function(ctx) {
        var w = this.width
        var h = this.height
        var ndx = (((Math.floor(this.angle / 10) % 36)+ 36) % 36)
        var xx = (ndx % 6) * w
        var yy = Math.floor(ndx / 6) * h

        ctx.drawImage(resources.get(this.url),
                      xx, yy,
                      w, h,
                      this.x - this.refx, 
                      this.y - this.refy,
                      w, h);
    }
})