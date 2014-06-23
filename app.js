
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// WebSocket
var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket) {
	socket.on('maps', function(e) {
        socket.emit('maps', e);
        socket.broadcast.emit('maps', e);
    });
});

// Routes
app.get('/', routes.index);
app.get('/maps/master', routes.maps_master);
app.get('/maps/slave', routes.maps_slave);


app.listen(8080, function(){
    console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

