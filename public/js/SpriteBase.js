
var SpriteBase = Base.extend({
    constructor: function(url, width, height, refx, refy) {
        this.width = width;
        this.height = height;
        this.refx = refx || 0;
        this.refy = refy || 0;
        this.x = 0
        this.y = 0
        this.url = url;
    },
    render: function(ctx) {
        var w = this.width
        var h = this.height

        ctx.drawImage(resources.get(this.url),
                      0, 0,
                      w, h,
                      this.x - this.refx, 
                      this.y - this.refy,
                      w, h);
    }
})