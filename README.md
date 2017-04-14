# AppState

__Appstate__ is a Javascript state manager, based on [Cerebral](https://github.com/christianalfoni/cerebral) signals conception.
Appstate use [Redux](https://github.com/react/redux) as main state storage.

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

### signal(store, services, args)

Run signal function, return `Promise` with signal run results.
Accept Redux store reference as `store`, `services` and `args` object.
