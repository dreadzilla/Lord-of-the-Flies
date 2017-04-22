
var express = require('express');
var app = express();
var serv = require('http').Server(app);

// Redirect to start file if /
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
// Only allow downloads from /client
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log('Server started.');

var SOCKET_LIST = {};
var PLAYER_LIST = {};
// Create a player with start position, number and ID and other data
var Player = function(id){
	var self = {
		x:250,
		y:250,
		id:id,
		number:"" + Math.floor(10*Math.random()),
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		maxSpd:10
	}
	self.updatePosition = function(){
		if(self.pressingRight){
			self.x += self.maxSpd;
		}
		if(self.pressingLeft){
			self.x -= self.maxSpd;
		}
		if(self.pressingUp){
			self.y -= self.maxSpd;
		}
		if(self.pressingDown){
			self.y += self.maxSpd;
		}
	}
	return self;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	// Give each person connecting their own id
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;


	//console.log('socket connection');
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});

	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;
	});

});
// Servertick 25 times per second
setInterval(function(){
	var pack = [];
	// Go through player list and update their data.
	for(var i in PLAYER_LIST){
		var player = PLAYER_LIST[i];
		player.updatePosition();
		pack.push({
			x: player.x,
			y: player.y,
			number: player.number
		});
	}
	// Send everyones' positions to the client
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
	}
}, 1000/25);
