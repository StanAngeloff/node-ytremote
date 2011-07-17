$.fn.value = function fn_value() {
  return this.get(0).childNodes[0].nodeValue;
};
(function($, Z) {
  var klass = this;
  this.initialize = function initialize() {
    this.authoriseIfTokenPresent();
    if (this.token()) {
      $('#authorise').remove();
    } else {
      $('#button-authorise').bind('click', function(event) {
        event.preventDefault();
        klass.authorise();
      });
    }
    $(document.body).delegate('[data-role="page"]', 'pageshow', function() {
      if (this.id === 'unwatched') {
        klass.loadUnwatched($(this));
      }
    });
    Z.initialize();
  };
  this.uri = function uri(file) {
    return location.href.split('/').slice(0, 3).join('/') + '/' + (file || '');
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
      return this.exception('Authorisation failed, no token was returned by Google.');
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
          return klass.exception('Authorisation failed, no token was returned by Google.');
        }
        klass.token(options.Token);
        location.replace(klass.uri('remote.html'));
      },
      error: function(xhr, type) {
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
  this.broadcast = function connect() {
    var args  = Array.prototype.slice.call(arguments),
        block = args.pop();
    if ( ! this.socket) {
      this.socket = io.connect(this.uri());
      this.socket.once('connect', function() {
        this.emit.apply(this, args);
        block();
      });
      this.socket.on('error', function(message) {
        this.removeAllListeners('connect');
        klass.exception('Socket exception: ' + (message || 'failed to connect to the server.'));
      });
    } else if ( ! this.socket.connected) {
      this.socket.socket.connect();
      this.socket.once('connect', function() {
        this.emit.apply(this, args);
        block();
      });
    } else {
      this.socket.emit.apply(this.socket, args);
      block();
    }
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
      for (var i = 0, video; video = $(entries[i]), i < entries.length; i ++) {
        $unwatched.append($(template.
          replace('{{title}}',     video.find('title[type="text"]').value()).
          replace('{{href}}',      video.find('link[rel="alternate"][type="text/html"]').attr('href')).
          replace('{{thumbnail}}', video.find('group thumbnail[width="120"]').first().attr('url')).
          replace('{{user}}',      video.find('author name').value()).
          replace('{{time}}',      Date.relative(new Date(Date.parse(video.find('published').value().replace('T', ' ').split('.').shift()))))
        ));
      }
      $unwatched.delegate('a', 'click', function(event) {
        event.preventDefault();
        klass.broadcast('play', this.href, function() {
          // TODO:
        });
      });
      $page.find('.loading').remove();
      Z.role($unwatched.removeClass('ui-collapsed'), 'list');
    });
  };
  Z.preventInitialize = true;
}).apply(this.YTRemote = {}, [this.Zepto, this.Zoey]);
