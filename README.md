# AppState

__Appstate__ is a Javascript state manager, based on [Cerebral](https://github.com/christianalfoni/cerebral) signals conception.
Appstate use [Baobab](https://github.com/Yomguithereal/baobab) as main state storage.

## Usage

### appstate.create(name, actions)

Create signal function. Accept `name` string and `actions` array.

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
   
   var signal = appstate.create('example', actions) // => Function
```

### signal.run(state, args)

Run signal function, return `Promise` with signal run results.
Accept Baobab tree reference as `state` and `args` object.
