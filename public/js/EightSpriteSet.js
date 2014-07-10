
var EightSpriteSet = SpriteBase.extend({
    /* 3*3 grid */
    /* angle in degrees */
    constructor: function(url, width, height, refx, refy, startx, starty, angle) {
        this.base(url, width, height, refx, refy)
        this.angle = angle
        this.startx = startx
        this.starty = starty
    },
    render: function(ctx) {
        var w = this.width
        var h = this.height
        var ndx = Math.floor((this.angle + 22.5)/45)
        var ndx = ((ndx % 8) + 8) % 8
        var map = [1,2,5,8,7,6,3,0]
        var ndx = map[ndx]
        var xx = (ndx % 3) * w
        var yy = Math.floor(ndx / 3) * h
        ctx.drawImage(resources.get(this.url),
                      this.startx+xx, 
                      this.starty+yy,
                      w, h,
                      this.x - this.refx, 
                      this.y - this.refy,
                      w, h);
    }
})