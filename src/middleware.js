const appstate = require('./appstate');

module.exports = function configureMiddleware (params = {}) {
  const {
    services = {},
    logError = console.error,
  } = params;

  return function middleware (store) {
    return (next) => function actionApplier (signal, args, ...rest) {
      if (!Array.isArray(signal)) {
        return next(signal, args, ...rest);
      }

      const signal = appstate.create(signal);

      signal(store, services, args)
        .catch((err) => logError(err));
    };
  };
}
