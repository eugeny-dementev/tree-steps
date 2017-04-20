'use strict';

var appstate = require('./appstate');

module.exports = function configureMiddleware() {
  var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var _params$services = params.services,
      services = _params$services === undefined ? {} : _params$services,
      _params$logError = params.logError,
      logError = _params$logError === undefined ? console.error : _params$logError,
      _params$logSuccess = params.logSuccess,
      logSuccess = _params$logSuccess === undefined ? function () {} : _params$logSuccess;


  return function appstateMiddleware(store) {
    return function (next) {
      return function signalExecutor(actions, args) {
        if (!Array.isArray(actions)) {
          for (var _len = arguments.length, rest = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
            rest[_key - 2] = arguments[_key];
          }

          return next.apply(undefined, [actions, args].concat(rest));
        }

        var signal = appstate.create(actions);

        signal(store, services, args).then(logSuccess).catch(logError);
      };
    };
  };
};
