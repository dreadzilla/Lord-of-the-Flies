// A small world theme game create for Ludum Dare 38
// Author: Hakan Staby, 2017-Apr-24
var express = require('express');
var app = express();
var serv = require('http').Server(app);
var DEBUG = true;
var collDist = 32; //Collision distance
var MAPWIDTH = 500;
var MAPHEIGHT = 500;

// Redirect to start file if /
app.get('/',function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
// Only allow downloads from /client
app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000);
console.log('Server started.');

var SOCKET_LIST = {};
// Entity class
var Entity = function(param) {
	var self = {
		x:250,
		y:250,
		spdX:0,
		spdY:0,
		id:"",
	}
	if(param){
		if(param.x)
			self.x = param.x;
		if(param.y)
			self.y = param.y;
		if(param.map)
			self.map = param.map;
		if(param.id)
			self.id = param.id;
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function() {
		self.x += self.spdX;
		self.y += self.spdY;
		//console.log(self.x);
	}
	self.getDistance = function(pt){
    return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
  }
	self.broadcastHit = function(action){
		for (var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('sndPlayerHit',action);
		}
	}
	return self;
}
//
// CLASS PLayer class with player based stuff
//
// Create a player with start position, number and ID and other data
var Player = function(param){
	var self = Entity(param);
	self.username = param.username;
	self.number = "" + Math.floor(10*Math.random());
	self.pressingRight = false,
	self.pressingLeft = false,
	self.pressingUp = false,
	self.pressingDown = false,
	self.pressingAttack = false,
	self.mouseAngle = 0,
	self.maxSpd = 10,
	self.hp = 10,
	self.hpMax = 10,
	self.score = 0,
	self.attackctr = 0, // keep check on attack speed.
	self.atkSpd = 1

	var super_update = self.update;
	// will call both updateSpd and the Player update.
	self.update = function() {
		self.updateSpd();
		super_update();

		// Create bullet
		if (self.pressingAttack){
			self.attackctr += self.atkSpd; // restrain shooting speed
			if(self.attackctr > 3){
				self.attackctr = 0;
				self.shootBullet(self.mouseAngle)
				self.broadcastHit('gun');
			}
			//for (var i = -3; i<3;i++)
			//	self.shootBullet(i*10+self.mouseAngle);

		}
	}
	self.shootBullet = function(angle){
		Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
		});
	}

	self.updateSpd = function(){
		// Add map collision here. The user can't travel farther than the map
		// Borders are hard coded now.
		//console.log(self.x);
		if(self.pressingRight){
			if (self.x < 770)
				self.spdX = self.maxSpd;
			else {
				self.spdX = 0;
			}
		}
		else if(self.pressingLeft){
			if (self.x > 30)
				self.spdX = -self.maxSpd;
			else
				self.spdX = 0;
		}
		else
			self.spdX = 0;
		if(self.pressingUp){
			if(self.y > 30)
				self.spdY = -self.maxSpd;
			else
				self.spdY = 0;
		}
		else if(self.pressingDown){
			if(self.y < 550)
				self.spdY = self.maxSpd;
			else
				self.spdY = 0;
		}
		else
			self.spdY = 0;
	}
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			number:self.number,
			hp: self.hp,
			hpMax: self.hpMax,
			score: self.score,
		};
	}
	self.getUpdatePack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y,
			hp: self.hp,
			score: self.score,
		};
	}
	Player.list[self.id] = self;
	initPack.player.push(self.getInitPack());
	return self;
}

Player.list = {};
Player.onConnect = function(socket,username){
	var player = Player({
		username:username,
		id:socket.id,
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
		else if(data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if(data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
	// Send chats out.
	socket.on('sendMsgToServer',function(data){
		for (var i in SOCKET_LIST){
			SOCKET_LIST[i].emit('addToChat',player.username+': '+data);
		}
	});
	// Initialize player stuff
	socket.emit('init', {
		selfId:socket.id, //refer player
		player:Player.getAllInitPack(),
		bullets:Bullet.getAllInitPack(),
	})
	// Broadcast new player.
	for (var i in SOCKET_LIST){
		SOCKET_LIST[i].emit('addToChat',player.username+': Joins the server.');
	}

}
Player.getAllInitPack = function(){
	var players = [];
	for (var i in Player.list)
		players.push(Player.list[i].getInitPack());
	return players;
}
// Remove disconnected player
Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}
Player.update = function(){
	var pack = [];
	// Go through player list and update their data.
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());
	}
	return pack;
}
// ENd Player class
//
// CLASS Bullet class
//
var Bullet = function(param){
    var self = Entity(param);
    self.id = Math.random();
		self.angle = param.angle;
    self.spdX = Math.cos(param.angle/180*Math.PI) * 10;
    self.spdY = Math.sin(param.angle/180*Math.PI) * 10;
		self.parent = param.parent;
    self.timer = 0;
    self.toRemove = false;
		// Override update loop
    var super_update = self.update;
    self.update = function(){
    	if(self.timer++ > 100)
        self.toRemove = true;
      super_update();
			for(var i in Player.list){
				var p = Player.list[i];
				if(self.getDistance(p) < collDist && self.parent !== p.id){
					// Handle possible collision here
					p.hp -= 1;
					self.broadcastHit('enemyhit'); //Send audio
					if (p.hp <= 0){
						self.broadcastHit('enemykill');
						var shooter = Player.list[self.parent];
						if(shooter) {
							shooter.score += 1;
						}
						// Broadcast kill.
						for (var i in SOCKET_LIST){
							SOCKET_LIST[i].emit('addToChat',shooter.username+' killed '+p.username
							+'. What a loser! :) --'+ shooter.username+ '\'s score is now: '+shooter.score);
						}
						p.hp = p.hpMax;
						p.x = Math.random() * 500;
						p.y = Math.random() * 500;
					}
					self.toRemove=true;
				}
			}
    }
		self.getInitPack = function(){
			return {
				id:self.id,
				x:self.x,
				y:self.y,
			}
		}
		self.getUpdatePack = function(){
			return {
				id: self.id,
				x: self.x,
				y: self.y,
			}
		}
    Bullet.list[self.id] = self;
		initPack.bullet.push(self.getInitPack());
    return self;
}
Bullet.getAllInitPack = function(){
	var bullets = [];
	for (var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
}

Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	// Go through player list and update their data.
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove) {
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else {
			pack.push(bullet.getUpdatePack());
		}
	}
	return pack;
}

var isValidPassword = function(data,cb){
	return cb(true);
}
var isUsernameTaken = function(data,cb){
	return cb(false);
}
var addUser = function(data,cb){
	return(cb);
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	// Give each person connecting their own id
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	socket.on('signIn',function(data){
		isValidPassword(data,function(res){
	  	if(res){
	    	Player.onConnect(socket,data.username);
	      socket.emit('signInResponse',{success:true});
			} else {
	     	socket.emit('signInResponse',{success:false});
	    }
	  });
	});
	socket.on('signUp',function(data){
		isUsernameTaken(data,function(res){
	  	if(res){
	    	socket.emit('signUpResponse',{success:false});
			} else {
	    	addUser(data,function(){
	  			socket.emit('signUpResponse',{success:true});
	      });
	    }
		});
	});


	//console.log('socket connection');
	socket.on('disconnect',function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
	socket.on('evalServer',function(data){
		if (!DEBUG)
			return;
		var res = eval(data);
		socket.emit('evalAnswer',res);
	});
});

// Init and remove
var initPack = {player:[],bullet:[]};
var removePack = {player:[],bullet:[]};
// SERVER GAME LOOP
// Servertick 25 times per second
setInterval(function(){
	// Do updates
	var pack = {
		player:Player.update(),
		bullet:Bullet.update()
	}
	// Send everyones' positions to the client
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init',initPack);
		socket.emit('update',pack);
		socket.emit('remove',removePack);
	}
	initPack.player=[];
	initPack.bullet=[];
	removePack.player=[];
	removePack.bullet=[];
}, 1000/25);
