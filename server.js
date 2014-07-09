var express = require('express')
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require("fs")

app.use(express.static(__dirname + '/public'));

var createEmptyChunk = function(x, y, texture, size, emptyIndex) {
	var chunk = {
		x: x,
		y: y,
		size: size,
		layers: {
			ground: {
				texture: texture,
				empty: emptyIndex,
				tiles: []
			},
			obstacles: {
				texture: texture,
				empty: emptyIndex,
				tiles: []
			},
			overlay: {
				texture: texture,
				empty: emptyIndex,
				tiles: []
			}
		}
	}
	for(var i=0; i<size*size; i++) {
		chunk.layers.ground.tiles.push(emptyIndex)
		chunk.layers.obstacles.tiles.push(emptyIndex)
		chunk.layers.overlay.tiles.push(emptyIndex)
	}
	writeChunk(x, y, chunk)
	return chunk
}

var writeChunk = function(x, y, chunk) {
	var filename = x + "," + y + ".json"
	var json = JSON.stringify(chunk)
	fs.writeFileSync("public/chunks/"+filename, json, "utf8")
	return chunk
}

var loadChunk = function(x, y) {
	var filename = x + "," + y + ".json"
	if(fs.existsSync(filename)) {
		var json = fs.readFileSync("public/chunks/"+filename, "utf8")
		return JSON.parse(json)
	} else {
		return createEmptyChunk(x, y, "images/scifi-tileset.png", 16, 13+9*16)
	}
}

var writeChunkData = function(x, y, regions) {
	var chunk = loadChunk(x, y)
	for(var i=0; i<regions.length; i++) {
		var reg = regions[i]
		var layer = reg.layer
		var tiles = reg.tiles
		/* TODO smarter regions */
		chunk.layers[layer].tiles = tiles
	}
	console.log(chunk)
	writeChunk(x, y, chunk)
	return chunk
}

var precreateEmptyChunks = function(x1, x2, y1, y2) {
	for(var x=x1; x<=x2; x++) {
		for(var y=x1; y<=y2; y++) {
			 createEmptyChunk(x, y, "images/scifi-tileset.png", 16, 13+9*16)
		}
	}
}

//precreateEmptyChunks(-10, 10, -10, 10)

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.on('chat message', function(msg){
    console.log('message: ' + msg);
    socket.emit('response', { data: msg });
  });
  socket.on('chunk edit', function(msg){
    console.log('chunk data: ' + msg);
    writeChunkData(msg.x, msg.y, msg.regions)
  });
  socket.on('chunk get', function(msg){
    console.log('chunk get: ' + msg);
    socket.emit('chunk response', loadChunk(msg.x, msg.y));
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

/*
var chunk = loadChunk(1, 0)
console.log(chunk)

var chunk = writeChunkData(3, 3, [{tiles:[1,2,3,4,5,6,7,8,9,0]}])
console.log(chunk)
*/