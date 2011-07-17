var __yt_remote, __yt_queue = [];
this.onYouTubePlayerReady = function(arg) {
  if (typeof (arg) === 'function') {
    __yt_queue.push(arg);
  } else {
    for (var i = 0; i < __yt_queue.length; i ++) {
      __yt_queue[i](arg);
    }
  }
};
this.onYouTubeStateChange = function(state) {
  switch (state) {
    case 0: __yt_remote.socket.emit('stop');  break;
    case 1: __yt_remote.socket.emit('play');  break;
    case 2: __yt_remote.socket.emit('pause'); break;
  }
};
(function($) {
  var DEFAULT_VIDEO_ID  = 'FUgM105uN4c';
  var PROGRESS_INTERVAL = 2500;
  var klass = this;
  this.initialize = function initialize() {
    this.connect();
    this.createPlayer();
    __yt_remote = this;
  };
  this.uri = function uri(file) {
    return location.href.split('/').slice(0, 3).join('/') + '/' + (file || '');
  };
  this.getVideoId = function getVideoId(url) {
    var group = /v=([^&]+)/.exec(url);
    return group && group[1];
  };
  this.connect = function connect() {
    this.socket = io.connect(this.uri());
    this.socket.on('play', function(href) {
      if (href) {
        var previousId = klass.getVideoId(klass.player.getVideoUrl()),
            videoId    = klass.getVideoId(href);
        if (previousId === videoId) {
          klass.player.playVideo();
        } else {
          klass.player.stopVideo();
          if (videoId) {
            klass.player.loadVideoById(videoId);
            klass.player.playVideo();
          }
        }
      } else {
        klass.player.playVideo();
        klass.emitOptions();
      }
    });
    this.socket.on('pause', function() {
      klass.player.pauseVideo();
    });
    this.socket.on('stop', function() {
      klass.player.stopVideo();
    });
    this.socket.on('toggle', function() {
      if (klass.player.getPlayerState() === 1) {
        klass.socket.emit('pause');
      } else {
        klass.socket.emit('play');
      }
    });
    this.socket.on('volume', function(volume) {
      klass.player.setVolume(volume);
      klass.emitOptions();
    });
  };
  this.emitOptions = function emitOptions() {
    this.socket.emit('options', {
      volume:                 this.player.getVolume(),
      playbackQuality:        this.player.getPlaybackQuality(),
      availableQualityLevels: this.player.getAvailableQualityLevels()
    });
  };
  this.createPlayer = function createPlayer() {
    var $window = $(window);
    $embed = $('<embed src="http://www.youtube.com/v/' + DEFAULT_VIDEO_ID +
      '?version=3' +
      '&enablejsapi=1' +
      '&cc_load_policy=0' +
      '&fs=1' +
      '&hd=1' +
      '&iv_load_policy=3' +
      '&playerapiid=ytplayer' +
      '&rel=0' +
      '&showinfo=0' +
      '&showsearch=0' +
    '" type="application/x-shockwave-flash" allowfullscreen="true" allowscriptaccess="always">');
    $('#player').append($embed);
    this.player = $embed.get(0);
    $(window).bind('resize', function() {
      $embed.width($window.width()).height($window.height());
    }).trigger('resize');
    onYouTubePlayerReady(function() {
      klass.player.addEventListener('onStateChange', 'onYouTubeStateChange');
    });
    setInterval(function() {
      if (klass.player) {
        klass.socket.emit('progress', {
          duration: klass.player.getDuration(),
          time:     klass.player.getCurrentTime()
        });
      }
    }, PROGRESS_INTERVAL);
  };
}).apply(this.YTRemote = {}, [this.jQuery]);
