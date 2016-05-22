# AppState [![Build Status](https://travis-ci.org/catbee/appstate.svg)](https://travis-ci.org/markuplab/appstate)

__Appstate__ is a Javascript state manager, based on [Cerebral](https://github.com/christianalfoni/cerebral) signals conception.
Appstate use [Baobab](https://github.com/Yomguithereal/baobab) as main state storage.

## Usage

### appstate.create(actions)

Create signal function. Accept `actions` array.

### Example:

```
   var actions = [
     syncAction,
     [
      asyncAction, {
        success: [successSyncAction],
        error: [errorSyncAction]
       }
     ]
   ];
   
   var signal = appstate.create(actions) // => Function
```

### signal(state, services, args)

Run signal function, return `Promise` with signal run results.
Accept Baobab tree reference as `state`, `services` and `args` object.
