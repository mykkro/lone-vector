
var RotatedSpriteSet = Base.extend({
    /* 6*6 grid */
    /* angle in degrees */
    constructor: function(url, width, height, angle) {
        this.width = width;
        this.height = height;
        this.angle = angle
        this.url = url;
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
                      0, 0,
                      w, h);
    }
})