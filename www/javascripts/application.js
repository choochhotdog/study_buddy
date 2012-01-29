(function() {
  var SB;

  SB = {};

  $(function() {
    var _this = this;
    SB.Data = {
      categories: JSON.parse(localStorage.categories)
    };
    SB.Credentials = {};
    SB.App = {
      init: function() {
        this.checkHashForAuth();
        if (SB.Data.categories) {
          this.addCategories();
        } else {
          SB.Data.categories = [];
          this.loadSpreadsheets();
        }
        return $(document).bind('pagechange', this.onPageChange);
      },
      checkHashForAuth: function() {
        var param, params, _i, _len;
        if (location.hash.indexOf('access_token') === -1) return;
        params = location.hash.split('&');
        params[0] = params[0].split('#')[1];
        SB.Credentials = {};
        for (_i = 0, _len = params.length; _i < _len; _i++) {
          param = params[_i];
          param = param.split('=');
          SB.Credentials[param[0]] = param[1];
        }
        return $.mobile.changePage($('#spreadsheet-list'));
      },
      onPageChange: function(e, data) {
        switch (location.hash) {
          case '#quiz':
            return SB.App.startQuiz();
          case '#spreadsheet-list':
            return SB.App.loadSpreadsheets();
        }
      },
      addCategories: function() {
        var $container, category, html, index, _ref;
        _ref = SB.Data.categories;
        for (index in _ref) {
          category = _ref[index];
          category['index'] = index;
        }
        $container = $('#main #categories');
        $container.empty();
        html = SB.Templates.categories(SB.Data.categories);
        $(html).appendTo($container);
        return $('#main').trigger('create');
      },
      startQuiz: function() {
        var bank, category, index, inputEl, question, selected, _i, _j, _len, _len2, _ref;
        bank = [];
        selected = $('#main #categories input:checked');
        for (_i = 0, _len = selected.length; _i < _len; _i++) {
          inputEl = selected[_i];
          index = $(inputEl).attr('index');
          category = SB.Data.categories[index];
          _ref = category.items;
          for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
            question = _ref[_j];
            bank.push(question);
          }
        }
        return this.nextQuestion(bank, 0);
      },
      nextQuestion: function(bank, index) {
        var $contentEl, context, html, item,
          _this = this;
        context = {
          question: bank[index][0],
          answer: bank[index][1]
        };
        $contentEl = $('#quiz #content');
        $contentEl.empty();
        html = SB.Templates.question(context);
        item = $(html).appendTo($contentEl);
        item.collapsible();
        $('#quiz #question-count').text(bank.length + ' remaining');
        $('#quiz #shuffle-btn, #quiz #got-it-btn, #quiz #next-question-btn').unbind('click');
        $('#quiz #shuffle-btn').click(function(e) {
          bank.shuffle();
          return _this.nextQuestion(bank, 0);
        });
        $('#quiz #got-it-btn').click(function(e) {
          bank.remove(index);
          if (bank.length === 0) {
            return _this.quizComplete();
          } else {
            return _this.nextQuestion(bank, index);
          }
        });
        $('#quiz #next-question-btn').click(function(e) {
          index++;
          if (index === bank.length) index = 0;
          return _this.nextQuestion(bank, index);
        });
      },
      quizComplete: function() {
        alert('Nice job!');
        return $.mobile.changePage($('#main'));
      },
      loadSpreadsheets: function() {
        var accessToken, alt, baseUrl, url,
          _this = this;
        if (!SB.Credentials.access_token) {
          this.authenticateUser();
          return;
        }
        baseUrl = 'https://spreadsheets.google.com/feeds/spreadsheets/private/full';
        accessToken = "access_token=" + SB.Credentials.access_token;
        alt = 'alt=json-in-script';
        url = "" + baseUrl + "?" + accessToken + "&" + alt;
        $.mobile.showPageLoadingMsg();
        return $.ajax({
          url: url,
          dataType: 'jsonp',
          success: function(data) {
            $.mobile.hidePageLoadingMsg();
            return _this.renderSpreadsheetList(data.feed.entry);
          },
          error: function() {
            $.mobile.hidePageLoadingMsg();
            return alert('Problem fetching data.');
          }
        });
      },
      renderSpreadsheetList: function(spreadsheets) {
        var $container, html,
          _this = this;
        $container = $('#spreadsheet-list ul#spreadsheets');
        html = SB.Templates.spreadsheets(spreadsheets);
        $(html).appendTo($container);
        $container.listview('refresh');
        return $container.find('a').click(function(e) {
          var remoteUrl;
          remoteUrl = $(e.currentTarget).attr('remote-url');
          return _this.loadSpreadsheet(remoteUrl);
        });
      },
      loadSpreadsheet: function(remoteUrl) {
        var accessToken, alt, url,
          _this = this;
        accessToken = "access_token=" + SB.Credentials.access_token;
        alt = 'alt=json-in-script';
        url = "" + remoteUrl + "?" + accessToken + "&" + alt;
        $.mobile.showPageLoadingMsg();
        return $.ajax({
          url: url,
          dataType: 'jsonp',
          success: function(data) {
            var baseUrl, entry, _i, _len, _ref, _results;
            _ref = data.feed.entry;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              entry = _ref[_i];
              baseUrl = entry.link[1].href;
              url = "" + baseUrl + "?" + accessToken + "&" + alt;
              _results.push(_this.loadCells(url));
            }
            return _results;
          },
          error: function() {
            $.mobile.hidePageLoadingMsg();
            return alert('Problem fetching data.');
          }
        });
      },
      loadCells: function(url) {
        var _this = this;
        return $.ajax({
          url: url,
          dataType: 'jsonp',
          success: function(data) {
            var entries, i, items, _ref;
            $.mobile.hidePageLoadingMsg();
            items = [];
            entries = data.feed.entry;
            for (i = 0, _ref = entries.length - 1; i <= _ref; i += 2) {
              try {
                items.push([entries[i].content.$t, entries[i + 1].content.$t]);
              } catch (error) {
                console.log(error);
                alert('Error in spreadsheet. Make sure it has only 2 columns: Question & Answer.');
                return;
              }
            }
            _this.addToCategory(data.feed.title.$t, items);
            $.mobile.changePage($('#main'));
            return SB.App.addCategories();
          },
          error: function() {
            $.mobile.hidePageLoadingMsg();
            return alert('Problem fetching cells from spreadsheet.');
          }
        });
      },
      addToCategory: function(name, items) {
        var category, categoryExists, newCategory, _i, _len, _ref;
        categoryExists = false;
        _ref = SB.Data.categories;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          category = _ref[_i];
          if (category.name === name) {
            category.items = category.items.concat(items);
            categoryExists = true;
          }
        }
        if (!categoryExists) {
          newCategory = {
            name: name,
            items: items
          };
          SB.Data.categories.push(newCategory);
          return localStorage.setItem('categories', JSON.stringify(SB.Data.categories));
        }
      },
      authenticateUser: function() {
        var baseUrl, clientId, fullUrl, parameters, redirectUri, responseType, scope;
        baseUrl = 'https://accounts.google.com/o/oauth2/auth';
        responseType = 'response_type=token';
        clientId = 'client_id=483114445763.apps.googleusercontent.com';
        redirectUri = 'redirect_uri=http://localhost:8888';
        scope = 'scope=https://docs.google.com/feeds/%20https://docs.googleusercontent.com/%20https://spreadsheets.google.com/feeds/';
        parameters = "" + responseType + "&" + clientId + "&" + redirectUri + "&" + scope;
        fullUrl = "" + baseUrl + "?" + parameters;
        return window.location = fullUrl;
      }
    };
    SB.Templates = {
      categories: Handlebars.compile($('#category-list-template').html()),
      question: Handlebars.compile($('#question-template').html()),
      spreadsheets: Handlebars.compile($('#spreadsheet-list-template').html())
    };
    return SB.App.init();
  });

  Handlebars.registerHelper('first', function(context, options) {
    var _base, _name;
    return (_base = context[0])[_name = options.hash.attr] || (_base[_name] = context[0]);
  });

  Array.prototype.shuffle = function() {
    return this.sort(function() {
      return 0.5 - Math.random();
    });
  };

  Array.prototype.remove = function(from, to) {
    var rest;
    rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
  };

  return;

}).call(this);
