
var Pool = Base.extend({
  constructor: function() {
    this.entities = []
  },
  removeDead: function() {
    for(var i = this.entities.length -1; i >= 0 ; i--){
        if(!this.entities[i].alive) {
            this.entities.splice(i, 1);
        }
    }
    /**/console.log("Entity count: "+this.entities.length)
  },
  update: function(dt) {
    for(var i = this.entities.length -1; i >= 0 ; i--){
        if(this.entities[i].alive) {
            this.entities[i].update(dt)
        }
    }
  },
  render: function(ctx) {
    for(var i = this.entities.length -1; i >= 0 ; i--){
        if(this.entities[i].alive) {
            this.entities[i].render(ctx)
        }
    }
  },
  add: function(ent) {
    this.entities.push(ent)
  },
  remove: function(ent) {
    for(var i = this.entities.length -1; i >= 0 ; i--){
        if(this.entities[i] == ent) {
            elements.splice(i, 1);
            return
        }
    }
  }
})

var Entity = Base.extend({
  constructor: function(x, y, sprite) {
    this.x = x
    this.y = y
    this.speed = 0
    this.dx = 1
    this.dy = 0
    this.sprite = sprite
    this.alive = true
    this.entityTime = 0
    this.duration = 0
  },
  update: function(dt) {
    if(this.speed>0) {
      this.x += this.speed * this.dx
      this.y += this.speed * this.dy
    }
    this.sprite.x = Math.floor(this.x)
    this.sprite.y = Math.floor(this.y)
    this.entityTime += dt
    if(this.duration && (this.entityTime > this.duration)) {
      this.alive = false
    }
  },
  render: function(ctx) {
    this.sprite.render(ctx)
  } 
})

var ExplosionEntity = Entity.extend({
  constructor: function(x,y) {
    this.base(x, y, new AnimatedSprite('images/M484ExplosionSet1.png', 34, 34, 17, 17, 90, 8, 8))
  },
  update: function(dt) {
    this.base(dt)
    var frame = Math.floor(this.entityTime * 16)
    if(frame<8) {
      this.sprite.frame = frame
    } else {
      this.alive = false
    }
  }
})

var ShipEntity = Entity.extend({
  constructor: function(x, y, angle) {
    this.angle = angle
    this.base(x, y,  new RotatedSpriteSet('images/flyer-88x83.png', 88, 83, 44, 42, angle)) 
  },
  update: function(dt) {
    this.base(dt)
    this.sprite.angle = this.angle
  }
})

var App = Base.extend({
  constructor: function() {
    this.gameTime = 0
    this.lastTime = 0
    this.ctx = null
    this.frame = 0
  },
  // run once - load resources, create GUI...
  init: function() {
    console.log("App initializing...")

    this.socket = io();

    this.gm = new GameMap(this.socket)
    this.currentTile = 9*16+13
    this.currentLayer = "overlay"

    this.pool = new Pool()

      // Create the canvas
  	var canvas = document.createElement("canvas");
  	this.ctx = canvas.getContext("2d");
  	canvas.width = 512;
  	canvas.height = 512;
  	document.body.appendChild(canvas);

    var self = this
    $(canvas).click(function(eventObject) {
      var mouseX = eventObject.pageX - this.offsetLeft;
      var mouseY = eventObject.pageY - this.offsetTop;
      self.paint(mouseX, mouseY)
    });
    $(canvas).mousemove(function(eventObject){
     if(eventObject.which==1)
     {
      var mouseX = eventObject.pageX - this.offsetLeft;
      var mouseY = eventObject.pageY - this.offsetTop;
      self.paint(mouseX, mouseY)
     }
    });

    $("#tileset").click(function(event) {
      var $this = $(this);
      var parentOffset = $this.parent().offset();
      var offset = $this.offset()
      var mouseX = event.pageX - parentOffset.left - offset.left;
      var mouseY = event.pageY - parentOffset.top - offset.top;     
      var px = Math.floor(mouseX/32)
      var py = Math.floor(mouseY/32)
      self.currentTile = px + py*16
      console.log(mouseX+","+mouseY+"  "+px+","+py)
    })

    var selectLayer = function(name) {
      self.currentLayer = name
      $("#layer-selector button").removeClass("selected")
      $("#layer-selector button."+name).addClass("selected")
    }

    var selectGround = function() {
      selectLayer("ground")
    }
    var selectObstacles = function() {
      selectLayer("obstacles")
    }
    var selectOverlay = function() {
      selectLayer("overlay")
    }

    $("#layer-selector").append(
      $("<button>").addClass("ground").text("ground").click(selectGround),
      $("<button>").addClass("obstacles").text("obstacles").click(selectObstacles),
      $("<button>").addClass("overlay").text("overlay").click(selectOverlay)
    )

    selectGround()

    this.socket.on('response', function(data){
      console.log(data);
    });

    this.ship = new ShipEntity(32*8, 32*8, 0)
    this.pool.add(this.ship)


  /*
  $('#btn1').click(function(){
    socket.emit('chat message', {"foo":"bar"});
    return false;
  });
*/

    this.lastTime = Date.now();
    this.main();

  },
  addExplosion: function() {
    var x = Math.floor(Math.random()*512)
    var y = Math.floor(Math.random()*512)
    this.pool.add(new ExplosionEntity(x, y))
  },
  paint: function(mouseX, mouseY) {
    var x = Math.floor(mouseX / 32) + this.gm.x
    var y = Math.floor(mouseY / 32) + this.gm.y
    this.gm.put(this.currentLayer, x, y, this.currentTile)
  },
  main: function() {
    var now = Date.now();
    var dt = (now - this.lastTime) / 1000.0;

    this.update(dt);
    this.render();

    this.lastTime = now;
    var self = this
    var foo = function() {
      self.main()
    }
    requestAnimFrame(foo);
  },
  update: function(dt) {

    this.gameTime += dt;
    this.handleInput(dt);
    if(this.frame % 30 == 0) {
      this.gm.preloadChunks()
    }
    if(this.frame % 3600 == 0) {
      this.gm.saveChangedChunks(this.socket)
    }
    this.frame++
    this.pool.update(dt)
    this.pool.removeDead()
    //if(this.frame % 4 == 0) {
      this.addExplosion()
    //}
  },
  // Draw everything
  render: function() {
      //console.log("Rendering...")
      this.ctx.clearRect ( 0 , 0 , 512 , 512 );
      this.gm.renderBackground(this.ctx)
      this.gm.renderLayer(this.ctx, "ground")
      this.gm.renderLayer(this.ctx, "obstacles")
      this.pool.render(this.ctx)
      this.gm.renderLayer(this.ctx, "overlay")
  },
  moveMap: function(dx, dy) {
    this.gm.x += dx
    this.gm.y += dy
    $("#map-position").text(this.gm.x+","+this.gm.y)
  },
  handleInput: function(dt) {
    if(input.isDown('DOWN')) {
        //console.log("Down")
        this.moveMap(0,1)
    }

    if(input.isDown('UP')) {
        //console.log("Up")
        this.moveMap(0,-1)
    }

    if(input.isDown('LEFT')) {
        //console.log("Left")
        this.moveMap(-1,0)
    }

    if(input.isDown('RIGHT')) {
        //console.log("Right")
        this.moveMap(1,0)
    }

    if(input.isDown('s')) {
        //console.log("Down")
        this.ship.y += 1
    }

    if(input.isDown('w')) {
        //console.log("Up")
        this.ship.y -= 1
    }

    if(input.isDown('a')) {
        //console.log("Left")
        this.ship.x -= 1
    }

    if(input.isDown('d')) {
        //console.log("Right")
        this.ship.x += 1
    }

    if(input.isDown('z')) {
        //console.log("Right")
        this.ship.angle -= 5
    }

    if(input.isDown('x')) {
        //console.log("Right")
        this.ship.angle += 5
    }

    if(input.isDown('SPACE') && ((this.frame % 8) == 0)) {
        //console.log("Space")
      var angle = this.ship.angle
      var aa = 2*Math.PI*angle/360
      var ca = Math.sin(aa)
      var sa = -Math.cos(aa)
      var xx = Math.floor(this.ship.x + 50*ca)
      var yy = Math.floor(this.ship.y + 50*sa)
      var ent = new Entity(xx, yy, new EightSpriteSet('images/M484BulletCollection1.png', 20, 17, 10, 8, 177, 194, angle))
      ent.dx = ca
      ent.dy = sa
      ent.speed = 10
      ent.duration = 0.5
      this.pool.add(ent)
    }
  }




})