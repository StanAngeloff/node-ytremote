(function() {
var socket, queue = [];
this.onYouTubePlayerReady = function(arg) {
  if (typeof (arg) === 'function') {
    queue.push(arg);
  } else {
    for (var i = 0; i < queue.length; i ++) {
      queue[i](arg);
    }
  }
};
this.onStateChange = function(state) {
  switch (state) {
    case 0: socket.send('player:pause'); break;
    case 1: socket.send('player:play'); break;
    case 2: socket.send('player:pause'); break;
    case 3: socket.send('player:pause'); break;
  }
};
var YTRemote = function YTRemote() {
  this.initialize();
};
YTRemote.prototype.initialize = function initialize() {
  var self = this;
  socket = new io.Socket(location.hostname);
  socket.connect();
  socket.on('message', function(message) {
    switch (message) {
      case 'player:play':
        self.player.playVideo();
        break;
      case 'player:pause':
        self.player.pauseVideo();
        break;
      default:
        if (message.indexOf('volume:') === 0) {
          self.player.setVolume(parseInt(message.slice(7)));
        } else {
          self.play(message);
        }
    }
  })
};
YTRemote.prototype.play = function play(id) {
  var self = this;
  if (this.player) {
    this.player.loadVideoById(id, 0, 'hd720');
  } else {
    $('#player').html(
      '<embed src="http://www.youtube.com/v/' + id +
        '?version=3' +
        '&cc_load_policy=0' +
        '&enablejsapi=1' +
        '&fs=1' +
        '&hd=1' +
        '&iv_load_policy=3' +
        '&playerapiid=ytplayer' +
        '&rel=0' +
        '&showinfo=0' +
        '&showsearch=0' +
      '" type="application/x-shockwave-flash" allowfullscreen="true" allowscriptaccess="always" width="100%" height="100%">'
    );
    this.player = $('#player').find('embed').first().get(0);
    onYouTubePlayerReady(function() {
      self.player.addEventListener('onStateChange', 'onStateChange');
      self.play(id);
    });
  }
};
new YTRemote();
}).call(this);
