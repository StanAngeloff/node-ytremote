$.fn.value = function fn_value() {
  return this.get(0).childNodes[0].nodeValue;
};
(function($, Z) {
  var klass = this;
  this.initialize = function initialize() {
    this.cache = {};
    this.authoriseIfTokenPresent();
    if (this.token()) {
      $('#authorise').remove();
      $('#button-play-pause').bind('click', function(event) {
        event.preventDefault();
        klass.emit('toggle');
      });
    } else {
      $('#button-authorise').bind('click', function(event) {
        event.preventDefault();
        klass.authorise();
      });
    }
    $(document.body).delegate('[data-role="page"]', 'pageshow', function() {
      if (this.id === 'unwatched') {
        klass.loadUnwatched($(this));
      } else if (this.id === 'player') {
        klass.loadVideo($(this), null);
      }
    });
    Z.initialize();
    setTimeout(function() {
      $(window).trigger('resize');
    });
  };
  this.uri = function uri(file) {
    return location.href.split('/').slice(0, 3).join('/') + '/' + (file || '');
  };
  this.restart = function restart() {
    location.replace(this.uri('remote.html'));
  };
  this.exception = function exception(message) {
    $('#exception-message').html(message);
    location.hash = 'exception';
  };
  this.token = function token(value) {
    var key = 'YTRemote:token';
    if (value) {
      localStorage[key] = value;
      return this;
    }
    return localStorage[key];
  };
  this.authoriseIfTokenPresent = function authoriseIfTokenPresent() {
    if (location.search.indexOf('token') < 0) {
      return false;
    }
    var options = {}, query = location.search.slice(1).split('&');
    for (var i = 0, parts; i < query.length; i ++) {
      parts = query[i].split('=');
      options[parts[0]] = parts[1];
    }
    if ( ! options.token) {
      this.exception('Authorisation failed, no token was returned by Google.');
      return false;
    }
    var self = this;
    Z.loading(true);
    $.ajax({
      type: 'GET',
      url:  this.uri('www.google.com/443/accounts/AuthSubSessionToken'),
      headers: {
        'Authorization': 'AuthSub token="' + options.token + '"'
      },
      dataType: 'text',
      success: function(body) {
        var options = {}, query = body.split(/[\r\n]+/);
        for (var i = 0, parts; i < query.length; i ++) {
          parts = query[i].split('=');
          options[parts[0]] = parts[1];
        }
        if ( ! options.Token) {
          Z.loading(false);
          klass.exception('Authorisation failed, no token was returned by Google.');
          return false;
        }
        klass.token(options.Token);
        klass.restart();
      },
      error: function(xhr, type) {
        alert(1);
        Z.loading(false);
        klass.exception('Authorisation failed, Google returned ' + xhr.status + ' ' + xhr.statusText + ': ' + xhr.responseText);
      }
    });
  };
  this.authorise = function authorise() {
    var $form = $('<form>').attr({
      method: 'POST',
      action: 'https://www.google.com/accounts/AuthSubRequest' +
        '?next='  + encodeURIComponent(this.uri('remote.html')) +
        '&scope=' + encodeURIComponent('http://gdata.youtube.com') +
        '&session=1' +
        '&secure=0'
    });
    $(document.body).append($form);
    $form.get(0).submit();
    Z.loading(true);
  };
  this.emit = function connect() {
    if ( ! this.socket) {
      this.socket = this.connect(io.connect(this.uri()));
    }
    this.socket.emit.apply(this.socket, Array.prototype.slice.call(arguments));
  };
  this.connect = function connect(socket) {
    socket.on('play', function(href) {
      $('#button-play-pause').text('||');
      if (href) {
        klass.loadVideo($('#player'), href);
      }
    });
    socket.on('pause', function() {
      $('#button-play-pause').html('&#x25B6;');
    });
    socket.on('stop', function() {
      $('#button-play-pause').html('&#x25A0;');
    });
    socket.on('options', function(options) {
      if (options.volume) {
        $('#player-volume').children().each(function() {
          var $this = $(this);
          if (parseInt($this.data('volume')) > options.volume) {
            $this.removeClass('on').addClass('off');
          } else {
            $this.removeClass('off').addClass('on');
          }
        });
      }
    });
    socket.on('progress', function(options) {
      // TODO: update video progress
    });
    return socket;
  };
  this.load = function load(endpoint, block) {
    Z.loading(true);
    $.ajax({
      type: 'GET',
      url:  this.uri('gdata.youtube.com/80/' + endpoint),
      headers: {
        'Authorization': 'AuthSub token="' + this.token() + '"'
      },
      dataType: 'xml',
      success: function(body) {
        Z.loading(false);
        block(new DOMParser().parseFromString(body, 'text/xml'));
      },
      error: function(xhr, type) {
        Z.loading(false);
        klass.exception('API failed, Google returned ' + xhr.status + ' ' + xhr.statusText + ': ' + xhr.responseText);
      }
    });
  };
  this.loadUnwatched = function loadUnwatched($page) {
    if (this.loadingUnwatched) {
      return true;
    }
    this.loadingUnwatched = true;
    this.load('feeds/api/users/default/newsubscriptionvideos', function(feed) {
      var template   = $('#template-unwatched').html(),
          $unwatched = $('#list-unwatched'),
          entries    = feed.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'entry');
      for (var i = 0, video, href, date, cache, html; video = $(entries[i]), i < entries.length; i ++) {
        href  = video.find('link[rel="alternate"][type="text/html"]').attr('href');
        date  = video.find('published').value().replace('T', ' ').split('.').shift().split(/[- :]/);
        cache = {
          href:      href,
          title:     video.find('title[type="text"]').value(),
          thumbnail: video.find('group thumbnail[width="120"]').first().attr('url'),
          user:      video.find('author name').value(),
          time:      Date.relative(new Date(date[0], date[1] - 1, date[2], date[3], date[4], date[5]))
        };
        html = template;
        for (var key in cache) {
          if (cache.hasOwnProperty(key)) {
            html = html.replace('{{' + key + '}}', cache[key]);
          }
        }
        $unwatched.append($(html));
        klass.cache[href] = cache;
      }
      $unwatched.delegate('a', 'click', function(event) {
        event.preventDefault();
        klass.emit('play', this.href);
      });
      $page.find('.loading').remove();
      Z.role($unwatched.removeClass('ui-collapsed'), 'list');
    });
  };
  this.loadVideo = function loadVideo($page, href) {
    if ( ! href && ! this.playingVideo) {
      klass.restart();
      return false;
    }
    if ( ! this.loadingVideo) {
      this.loadingVideo = true;
      var $volume = $('#player-volume'), previousVolume = null;
      for (var volume = 0, step = 5; volume <= 100; volume += step) {
        $volume.append($('<span>').data('volume', volume).css({ width: (step / 100) + '%' }).addClass('volume-step off'));
      }
      $(document).bind('mousemove touchmove', function(event) {
        if (event.target && ~event.target.className.indexOf('volume-step')) {
          var volume = parseInt($(event.target).data('volume'));
          event.preventDefault();
          event.stopPropagation();
          if (previousVolume !== volume) {
            klass.emit('volume', volume);
            previousVolume = volume;
            setTimeout(function() {
              previousVolume = null;
            }, 1000);
          }
        }
      });
    }
    this.playingVideo = href;
    location.hash = 'player';
  };
  Z.preventInitialize = true;
}).apply(this.YTRemote = {}, [this.Zepto, this.Zoey]);
