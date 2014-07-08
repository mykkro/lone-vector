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
		texture: texture,
		empty: emptyIndex,
		tiles: []
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
		return createEmptyChunk(x, y, "images/scifi-tileset.png", 16, 0)
	}
}

var writeChunkData = function(x, y, regions) {
	var chunk = loadChunk(x, y)
	for(var i=0; i<regions.length; i++) {
		var reg = regions[i]
		/* TODO smarter regions */
		chunk.tiles = reg.tiles
	}
	writeChunk(x, y, chunk)
	return chunk
}

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