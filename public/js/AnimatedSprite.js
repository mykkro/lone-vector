
var AnimatedSprite = SpriteBase.extend({
    constructor: function(url, width, height, refx, refy, sx, sy, frames) {
        this.base(url, width, height, refx, refy)
        this.startx = sx;
        this.starty = sy;
        this.frames = frames;
        this.frame = 0;
    },
    render: function(ctx) {
        var x = this.startx + this.frame * this.width
        var y = this.starty

        ctx.drawImage(resources.get(this.url),
                      x, y,
                      this.width, this.height,
                      this.x-this.refx, this.y-this.refy,
                      this.width, this.height);
    }
})