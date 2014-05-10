(function(angular, sp) {
  // Just in case...
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
      if ( this === undefined || this === null ) {
        throw new TypeError( '"this" is null or not defined' );
      }

      var length = this.length >>> 0; // Hack to convert object.length to a UInt32

      fromIndex = +fromIndex || 0;

      if (Math.abs(fromIndex) === Infinity) {
        fromIndex = 0;
      }

      if (fromIndex < 0) {
        fromIndex += length;
        if (fromIndex < 0) {
          fromIndex = 0;
        }
      }

      for (;fromIndex < length; fromIndex++) {
        if (this[fromIndex] === searchElement) {
          return fromIndex;
        }
      }

      return -1;
    };
  }

  angular.module('mvdSixpack', ['ngCookies'])
    .provider('sixpack', function() {
      var _tests = []
        , _opts = {
          baseUrl: '',
          debug: false,
        };

      this.setOptions = function (options) {
        angular.extend(_opts, options || {});
      }

      this.$get = ['$cookies','$timeout', '$log', function($cookies, $timeout, $log) {
        var _cookiePrefix = 'sixpack-'
          , _session
          , _clientId;

        _getOrInitSession = function () {
          if (!_session) {
            if (_clientId = $cookies[_cookiePrefix + 'clientId']) {
              _session = new sp.Session(_clientId, _opts.baseUrl);
            } else {
              _session = new sp.Session(undefined, _opts.baseUrl);
              $cookies[_cookiePrefix + 'clientId'] = _clientId = _session.client_id;
            }
            if (_opts.debug) {
              $log.debug('[sixpack] Initialized session with clientId', _clientId, 'and base url', _opts.baseUrl);
            };
          };
          return _session;
        }

        return {
          participate : function (testName, variations, callback) {
            if (_tests.indexOf(testName) < 0) {
              _tests.push(testName);
            };
            var session = _getOrInitSession();
            if (_opts.debug) {
              $log.info('[sixpack] Getting choice for', testName, 'out of', variations);
            };
            session.participate(testName, variations, function (err, res) {
              if (err) {
                if (_opts.debug) {
                  $log.warn('[sixpack] Received error', err);
                };
                $timeout(function () {
                  callback(false);
                });
                return;
              };
              var choice = res.alternative.name;
              if (_opts.debug) {
                $log.info('[sixpack] Alternative chosen:', choice);
                $log.debug('[sixpack] Full response', res);
              };
              $timeout(function() {
                callback(choice, res);
              });
            });
          },
          // Register a 'conversion'. If no testName, will call for all active tests
          // Takes an optional callback that receives the raw response from sixpack (or undefined on error)
          convert : function (testName, callback) {
            var session = _getOrInitSession();
            if (!testName) {
              if (_opts.debug) {
                $log.info("[sixpack] Recording conversion for all tests", _tests);
              };
              for (var i = 0, ii = _tests.length; i < ii; i++) {
                var test = _tests[i]
                  , results = [];
                session.convert(test, function (err, res) {
                  results.push(res);
                  if (err && _opts.debug) {
                    $log.warn("[sixpack] Error recording conversion for", test, err);
                  };
                  if (results.length == ii) {
                    if (_opts.debug) {
                      $log.debug('[sixpack] All results:', results);
                    };
                    if (callback) {
                      $timeout(function () {
                        callback(results);
                      });
                    }
                  };
                });
              }
            } else {
              if (_opts.debug) {
                $log.info("[sixpack] Recording conversion for", testName);
              };
              session.convert(testName, function (err, res) {
                if (err && _opts.debug) {
                  $log.warn('[sixpack] Error recording conversion:', err);
                } else if (_opts.debug) {
                  $log.debug('[sixpack] Conversion result:', res);
                };
                if (callback) {
                  $timeout(function () {
                    callback(res);
                  });
                }
              });
            }
          }
        }
      }];
    })
    .directive('sixpackSwitch', ['sixpack', function(sixpack) {
      return {
        controller : ['$element', function($element) {
          var ctrl = this
            , _testName
            // Map of variation names to transclude fns
            , _variations = {};

          var _processChoice = function (choice) {
            // Triggered if for some reason we get an error from sixpack,
            // or optionally if a user is excluded from this test via configuration
            if (!choice) {
              _setContent(_variations['default']);
            } else {
              _setContent(_variations[choice]);
            }
          }

          var _setContent = function (fn) {
            if (!fn) {
              return;
            };
            fn(function(clone) {
              $element.html(clone);
            });
          }

          // Pseudo-shim for '.keys' method
          // Additionally, if obj has a 'default' property, sets that as the first element
          // so sixpack will use it as the control
          var _keys = function (obj) {
            var keys = []
              , prop;
            for (prop in obj) {
              if (!obj.hasOwnProperty(prop)) {
                continue;
              };
              if (prop == 'default') {
                keys.unshift(prop);
              } else {
                keys.push(prop);
              }
            }
            return keys;
          }

          ctrl.registerSwitch = function (name) {
            _testName = name;
            sixpack.participate(_testName, _keys(_variations), _processChoice);
          }

          ctrl.registerVariation = function (variation, fn) {
            _variations[variation] = fn;
          }

          return ctrl;
        }],
        require: 'sixpackSwitch',
        link : function ($scope, $element, $attrs, ctrl) {
          ctrl.registerSwitch($attrs.sixpackSwitch);
        }
      }
    }])
    // Register a variation for a test
    .directive('sixpackWhen', function ($log) {
      return {
        require: '^sixpackSwitch',
        transclude: 'element',
        link: function($scope, $element, $attrs, ctrl, transcludeFn) {
          if ($attrs.sixpackWhen) {
            ctrl.registerVariation($attrs.sixpackWhen, transcludeFn);
          } else {
            $log.debug('[sixpack] When directive initialized without a name, ignoring');
          }
        }
      }
    })
    // Register the 'default view, registered as the control variation, and 
    // always used if sixpack errors out or if user is excluded via configuration
    .directive('sixpackDefault', function () {
      return {
        require: '^sixpackSwitch',
        transclude: 'element',
        link: function($scope, $element, $attrs, ctrl, transcludeFn) {
          ctrl.registerVariation('default', transcludeFn);
        }
      }
    })
    .directive('sixpackConvert', function (sixpack) {
      return {
        link : function ($scope, $element, $attrs) {
          var test = $attrs.sixpackConvert || undefined
            , eventType = $attrs.on || 'click';

          $element.on(eventType, function () {
            sixpack.convert(test);
          });
        }
      }
    });
})(window.angular, window.sixpack);