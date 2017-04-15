const appstate = require('./appstate');

module.exports = function configureMiddleware (params = {}) {
  const {
    services = {},
    logError = console.error,
    logSuccess = () => {},
  } = params;

  return function middleware (store) {
    return (next) => function actionApplier (signal, args, ...rest) {
      if (!Array.isArray(signal)) {
        return next(signal, args, ...rest);
      }

      const signalRunner = appstate.create(signal);

      signalRunner(store, services, args)
        .then((result) => logSuccess(result))
        .catch((err) => logError(err));
    };
  };
}
