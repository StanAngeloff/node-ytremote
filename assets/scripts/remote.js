$.fn.nodeVal = function() {
  return this.get(0).childNodes[0].nodeValue;
};
(function() {
var TOKEN_KEY = 'token';
var YTRemote = function YTRemote() {
  this.token = this.loadToken();
  if (this.token) {
    this.initialize();
  } else {
    this.authenticate();
  }
};
YTRemote.prototype.exception = function exception() {
  alert(Array.prototype.slice.call(arguments));
};
YTRemote.prototype.uri = function uri(href) {
  return location.href.split('/').slice(0, 3).join('/') + '/' + (href || '');
};
YTRemote.prototype.loadToken = function loadToken() {
  return localStorage[TOKEN_KEY];
};
YTRemote.prototype.saveToken = function saveToken(token) {
  localStorage[TOKEN_KEY] = this.token = token;
};
YTRemote.prototype.initialize = function initialize() {
  var self = this;
  this.socket = new io.Socket(location.hostname);
  this.socket.connect();
  this.socket.on('connect', function() {
    $.ajax({
      type: 'GET',
      url:  self.uri('/proxy/gdata.youtube.com/80/feeds/api/users/default/newsubscriptionvideos'),
      headers: {
        'Authorization': 'AuthSub token="' + self.token + '"'
      },
      dataType: 'xml',
      success: function(body) {
        self.display(new DOMParser().parseFromString(body, 'text/xml'));
      },
      error: function(xhr, type) {
        self.exception(new Error('Subscriptions failed, Google returned ' + xhr.status + ' ' + xhr.statusText + '.'));
      }
    });
  });
  this.socket.on('message', function(message) {
    switch (message) {
      case 'player:pause':
        self.$controls && self.$controls.find('.toggle').html('<span>Play</span>');
        self.isPlaying = false;
        break;
      case 'player:play':
        self.$controls && self.$controls.find('.toggle').html('<span>Pause</span>');
        self.isPlaying = true;
        break;
    }
  });
};
YTRemote.prototype.display = function display(feed) {
  var self    = this,
      entries = feed.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'entry'),
      $videos = $('<ul>').appendTo($('#videos')),
      lastURL;
  for (var i = 0; i < entries.length; i ++) {
    (function(video) {
      var $video     = $('<li>').appendTo($videos),
           videoURL  = video.find('link[rel="alternate"][type="text/html"]').attr('href').split('=')[1].split('&')[0],
          $anchor    = $('<a>').attr('href', '#/watch/' + videoURL).appendTo($video),
          $thumbnail = $('<img>').attr('src', video.find('group thumbnail[width="120"]').first().attr('url')).appendTo($anchor),
          $title     = $('<h2>').text(video.find('title[type="text"]').nodeVal()).appendTo($anchor),
          $author    = $('<p>').addClass('author').append($('<strong>').text(video.find('author name').nodeVal())).appendTo($anchor),
           published = new Date(Date.parse(video.find('published').nodeVal())),
          $published = $('<small>').addClass('published').text(published.toLocaleDateString() + ' ' + published.toLocaleTimeString()).appendTo($anchor);
      $anchor.bind('click', function(event) {
        event.preventDefault();
        if (lastURL === videoURL) {
          self.$controls && self.$controls.find('.toggle').trigger('click');
        } else {
          self.socket.send(videoURL);
          self.controls($video);
        }
        lastURL = videoURL;
      });
    })($(entries[i]));
  }
};
YTRemote.prototype.authenticate = function authenticate() {
  if (location.search.indexOf('token') > 0) {
    var options = {},
        query   = location.search.slice(1).split('&');
    for (var i = 0, pairs; i < query.length; i ++) {
      pairs = query[i].split('=');
      options[pairs[0]] = pairs[1];
    }
    if ( ! options.token) {
      return this.exception(new Error('Authentication failed, no token was returned by Google.'));
    }
    var self = this;
    $.ajax({
      type: 'GET',
      url:  this.uri('/proxy/www.google.com/443/accounts/AuthSubSessionToken'),
      headers: {
        'Authorization': 'AuthSub token="' + options.token + '"'
      },
      dataType: 'text',
      success: function(body) {
        var options = {},
            query   = body.split(/[\r\n]+/);
        for (var i = 0, pairs; i < query.length; i ++) {
          pairs = query[i].split('=');
          options[pairs[0]] = pairs[1];
        }
        if ( ! options.Token) {
          return self.exception(new Error('Authentication failed, no token was returned by Google.'));
        }
        self.saveToken(options.Token);
        self.initialize();
      },
      error: function(xhr, type) {
        self.exception(new Error('Authentication failed, Google returned ' + xhr.status + ' ' + xhr.statusText + '.'));
      }
    });
  } else {
    var $form = $('<form>').attr({
      method: 'POST',
      action:
        'https://www.google.com/accounts/AuthSubRequest' +
        '?next='  + encodeURIComponent(this.uri('remote')) +
        '&scope=' + encodeURIComponent('http://gdata.youtube.com') +
        '&session=1' +
        '&secure=0'
    });
    $(document.body).append($form);
    $form.get(0).submit();
  }
};
YTRemote.prototype.controls = function controls($video) {
  if (this.$controls) {
    this.$controls.remove();
  }
  var self       = this,
      $controls  = $('<div>').addClass('controls').appendTo($video),
      $playPause = $('<button>').addClass('toggle play').html('<span>Play</span>').appendTo($controls),
      $volume    = $('<div>').addClass('volume').appendTo($controls),
      lastVolume;
  for (var i = 0; i <= 100; i += 10) {
    (function(volume) {
      $volume.append($('<span>').data('volume', volume).addClass('off').bind('mousemove touchmove', function() {
        if (lastVolume === volume) {
          return true;
        }
        self.socket.send('volume:' + volume);
        $volume.children().each(function() {
          var $this = $(this);
          if (parseInt($this.data('volume')) > volume) {
            $this.removeClass('on').addClass('off');
          } else {
            $this.removeClass('off').addClass('on');
          }
        });
        lastVolume = volume;
      }));
    })(i);
  }
  $playPause.bind('click', function(event) {
    event && event.preventDefault();
    if (self.isPlaying) {
      self.socket.send('player:pause');
    } else {
      self.socket.send('player:play');
    }
  });
  this.$controls = $controls;
};
new YTRemote();
}).call(this);
