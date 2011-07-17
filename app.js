#!/usr/bin/env node

var http        = require('http'),
    https       = require('https'),
    path        = require('path'),
    querystring = require('querystring'),
    colorize    = require('colorize'),
    io          = require('socket.io'),
    paperboy    = require('paperboy');

const SERVER_PORT = 3000;
const SERVER_ROOT = path.join(__dirname, 'public');

var domains = ['www.google.com', 'gdata.youtube.com'];

var server = http.createServer(function(request, response) {
  paperboy.
    deliver(SERVER_ROOT, request, response).
    otherwise(function() {
      var parts = request.url.replace(/^\/|\/$/g, '').split('/'),
          host  = parts.shift();
      if (~domains.indexOf(host)) {
        var allowed = ['authorization'],
            copy    = {};
        for (var name in request.headers) {
          if (~allowed.indexOf(name)) {
            copy[name] = request.headers[name];
          }
        }
        var port = parseInt(parts.shift()),
            path = '/' + parts.join('/') + '?' + querystring.stringify(request.query);
        (port === 443 ? https : http).get({
          host:    host,
          path:    path,
          headers: copy
        }, function(r) {
          if (r.statusCode === 200) {
            var body = '';
            r.setEncoding('utf8');
            r.on('data', function(chunk) {
              body = body + chunk;
            });
            r.on('end', function() {
              response.end(body);
            });
          } else {
            response.writeHead(r.statusCode);
            response.end("Proxy failed, '" + host + "' returned status code '" + r.statusCode + "'.");
          }
        }).on('error', function(error) {
          response.writeHead(500);
          response.end("Proxy failed, request to '" + host + "' was unsuccessful.");
        });
      } else {
        response.writeHead(500);
        response.end("Proxy failed, domain '" + host + "' not allowed.");
      }
    });
});

server.listen(SERVER_PORT);

console.log(colorize.ansify('   #cyan[info  - ]listening on port #bold[' + SERVER_PORT + ']'));
console.log(colorize.ansify('   #cyan[info  - ]press Ctrl+C to exit]'));

var events = ['play', 'pause', 'toggle', 'options', 'progress', 'volume'];

var io = io.listen(server);

io.sockets.on('connection', function(client) {
  for (var i = 0; i < events.length; i ++) {
    (function(event) {
      client.on(event, function() {
        client.namespace.emit.apply(client.namespace, [event].concat(Array.prototype.slice.call(arguments)));
      });
    })(events[i]);
  }
});
