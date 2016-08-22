#!/usr/bin/node

var express = require('express');
var socket_io = require('socket.io');
var path = require('path');

/* Раздача статики */
var web = express();
web.set('PORT', process.env.PORT || 8080);
web.use(express.static(path.join(__dirname, 'public')));
var server = web.listen(web.get('PORT'), function () {
	console.log('* Server start on http://localhost:' + web.get('PORT'));
});

/* Обработка запросов */
var io = socket_io.listen(server).on('connection', function(client) {
	var send = function (message) {
		message.from = client.id;
		message.time = (new Date()).toISOString();
		message.to = message.to || 'all';
		message.type = message.type || 'message';
		message.content = message.content || '';
		var transit = function (otherClient) {
			if (otherClient && client.id !== otherClient.id) {
				otherClient.emit('message', message);
			}
		};
		if (io.sockets) {
			console.log('* Transit message', message);
			if (message.to != 'all') {
				transit(io.to(message.to));
			} else {
				for(var id in io.sockets) {
					transit(io.sockets[id]);
				}
			}
		}
	};
	send({type: 'connect'});
	client.on('message', send);
	client.on('disconnect', function () {
		send({type: 'disconnect'});
	});
});
