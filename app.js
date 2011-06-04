var http        = require('http'),
    https       = require('https'),
    querystring = require('querystring'),
    express     = require('express'),
    io          = require('socket.io');

var app = module.exports = express.createServer();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.disable('view cache');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/assets'));
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack:      true
  }));
});

app.get(/\/proxy\/(.*)/, function(request, response) {
  var allowed = ['authorization'],
      headers = {};
  for (var name in request.headers) {
    if (~allowed.indexOf(name)) {
      headers[name] = request.headers[name];
    }
  }
  var params = request.params[0].split('/'),
      host   = params.shift(),
      port   = parseInt(params.shift()),
      path   = '/' + params.join('/') + '?' + querystring.stringify(request.query);
  (port === 443 ? https : http).get({
    host:    host,
    path:    path,
    headers: headers
  }, function(r) {
    if (r.statusCode === 200) {
      var body = '';
      r.setEncoding('utf8');
      r.on('data', function(chunk) {
        body = body + chunk;
      });
      r.on('end', function() {
        response.send(body);
      });
    } else {
      response.send('Authentication failed, Google returned status code ' + r.statusCode, r.statusCode);
    }
  }).on('error', function(error) {
    response.send('Authentication failed, request to Google servers failed.', 500);
  });
});

app.get('/host', function(request, response) {
  response.render('host', { layout: false });
});

app.get('/remote', function(request, response) {
  response.render('remote', { layout: false });
});

app.listen(3000);

var socket = io.listen(app);

socket.on('connection', function(client) {
  client.on('message', function(message) {
    console.log("Relay '" + message + "'");
    client.broadcast(message);
  });
});

console.log('Express server listening on port %d', app.address().port);
