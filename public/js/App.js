
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
  /*
  $('#btn1').click(function(){
    socket.emit('chat message', {"foo":"bar"});
    return false;
  });
*/

    lastTime = Date.now();
    this.main();

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
  },
  // Draw everything
  render: function() {
      //console.log("Rendering...")
      this.ctx.clearRect ( 0 , 0 , 512 , 512 );
      this.gm.render(this.ctx)
  },
  moveMap: function(dx, dy) {
    this.gm.x += dx
    this.gm.y += dy
    $("#map-position").text(this.gm.x+","+this.gm.y)
  },
  handleInput: function(dt) {
    if(input.isDown('DOWN') || input.isDown('s')) {
        //console.log("Down")
        this.moveMap(0,1)
    }

    if(input.isDown('UP') || input.isDown('w')) {
        //console.log("Up")
        this.moveMap(0,-1)
    }

    if(input.isDown('LEFT') || input.isDown('a')) {
        //console.log("Left")
        this.moveMap(-1,0)
    }

    if(input.isDown('RIGHT') || input.isDown('d')) {
        //console.log("Right")
        this.moveMap(1,0)
    }

    if(input.isDown('SPACE')) {
        //console.log("Space")
    }
  }




})