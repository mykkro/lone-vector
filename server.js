// Static server for the game and the mission editor.
// Both also work straight from the file system or from GitHub Pages.
var express = require('express')
var path = require('path')

var port = process.env.PORT || 3000
var app = express()

app.use(express.static(path.join(__dirname, 'public')))

app.listen(port, function() {
  console.log('Lone Vector:     http://localhost:' + port + '/')
  console.log('Mission editor:  http://localhost:' + port + '/editor.html')
})
