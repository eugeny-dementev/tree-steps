# Redux-AppState [![Build Status](https://travis-ci.org/eugeny-dementev/appstate.svg)](https://travis-ci.org/eugeny-dementev/appstate)

__Appstate__ is a Javascript state manager, based on [Cerebral](https://github.com/christianalfoni/cerebral) signals conception.
Appstate use [Redux](https://github.com/react/redux) as main state storage.

## Usage

### Apply middleware
```js
  const configureAppState = require('redux-appstate');

  const middlewares = [
    configureAppState({ // should be first
      // services will be available in all signal actions.
      services: {
        api,
        // ...
      },
      // log all errors that occures in signal
      logError, // default "console.error"
      // log result of successful signal execution.
      logSuccess, // default "() => {}"
    }),
    // other middlewares
  ]

  const store = createStore(reducer, applyMiddleware(...middlewares));
```

### Dispatch signal with args
```js
  const signalActions = [
    syncAction,
    [
     asyncAction, { // outputs mapping
       success: [successSyncAction],
       error: [errorSyncAction]
      }
    ]
  ];

  store.dispatch(signalActions, args); // dispatch signal with arguments object
```

### Signal actions interface
```js
function syncAction ({
  args,
  getState, // get currect redux store state
  output, // output({ newArg: 'value' }) - extend "args" with "newArg"
  dispatch, // dispatch redux action. Only sync actions allowed to dispatch
  services,
}) {
}

function asyncAction ({
  args,
  getState,
  output, // output.success() or output.error(). outputs properties defines by outputs mapping object 
          // one and only one of outputs must be called to resolve async action
  services,
}) {
}
```
