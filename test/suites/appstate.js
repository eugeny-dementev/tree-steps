var Lab = require('lab');
var lab = exports.lab = Lab.script();
var assert = require('assert');
var { createStore } = require('redux');
var appstate = require('../../src/appstate');

function reducer (state = {}, action) {
  switch (action.type) {
    case 'SET_PROPERTY': {
      return Object.assign({}, state, {
        [action.name]: action.value,
      });
    }
    default:
      return state;
  }
}

/**
 * Test helpers
 */
function noop () {}

/**
 * Cases
 */
lab.experiment('#appstate', function () {
  var store;

  lab.beforeEach(function(done) {
    store = createStore(reducer);
    done();
  });

  lab.test('should run signal with one sync action', function(done) {
    var signal = appstate.create([noop]);
    signal(store);

    done();
  });

  lab.test('should throw exception if signal defined incorrect', function(done) {
    assert.throws(appstate.create.bind(null, [undefined]), Error);
    done();
  });

  lab.test('should run signal with one sync action, dispatch redux action and modify store', function(done) {
    function sync ({ args, dispatch }) {
      dispatch({
        type: 'SET_PROPERTY',
        name: 'hello',
        value: args.hello,
      });
    }

    var signal = appstate.create([sync]);

    signal(store, {}, { hello: 'world' });
    assert.equal(store.getState().hello, 'world');

    done();
  });

  lab.test('should run signal with two sync action and modify store', function(done) {
    function first ({ args, dispatch }) {
      dispatch({
        type: 'SET_PROPERTY',
        name: 'hello',
        value: 'world',
      });
    }

    function second ({ args, dispatch }) {
      dispatch({
        type: 'SET_PROPERTY',
        name: 'hello',
        value: 'planet',
      });
    }

    var signal = appstate.create([first, second]);

    signal(store);

    assert.equal(store.getState().hello, 'planet');
    done();
  });

  lab.test('should run signal with one async action and output to success', function (done) {
    function async ({ output }) {
      output.success();
    }

    function success () {
      done();
    }

    var signal = appstate.create([
      [
        async, {
          success: [
            success
          ]
        }
      ]
    ]);

    signal(store);
  });

  lab.test('should pass async acton output args to next actions', function (done) {
    function async ({ output }) {
      output.success({ test: 'test' });
    }

    function success ({ args }) {
      assert(args.test);
      done();
    }

    var signal = appstate.create([
      [
        async, {
          success: [
            success
          ]
        }
      ]
    ]);

    signal(store);
  });

  lab.test('should not contains dispatch if action is async', function (done) {
    function async ({ dispatch, getState, output }) {
      assert(!dispatch);
      assert(getState);

      output.success();
    }

    function success ({ dispatch, getState }) {
      assert(dispatch);
      assert(getState);

      done();
    }

    var signal = appstate.create([
      [
        async, {
        success: [
            success
          ]
        }
      ]
    ]);

    signal(store);
  });

  lab.test('should can output to different ways from sync action', function (done) {
    function sync ({ output }) {
      output.success();
    }

    function success () {
      done();
    }

    var signal = appstate.create([
      sync, {
        success: [
          success
        ]
      }
    ]);

    signal(store);
  });

  lab.test('should pass arguments to outputs if action is sync', function (done) {
    function sync ({ output }) {
      output.success({ test: 'test' });
    }

    function success ({ args }) {
      assert(args.test);

      done();
    }

    var signal = appstate.create([
      sync, {
        success: [
          success
        ]
      }
    ]);

    signal(store);
  });

  lab.test('should correct run chain of sync and async actions', function (done) {
    var times = 0;

    function syncWithoutOutputFirst () {
      times += 1;
      assert.equal(times, 1);
    }

    function syncWithoutOutputSecond () {
      times += 1;
      assert.equal(times, 4);
    }

    function syncWithOutput ({ output }) {
      times += 1;
      assert.equal(times, 2);
      output.success();
    }

    function async ({ output }) {
      times += 1;
      assert.equal(times, 5);
      output.success();
    }

    function successSync () {
      times += 1;
      assert.equal(times, 3);
    }

    function successAsync () {
      times += 1;
      assert.equal(times, 6);
    }

    function syncFinal () {
      times += 1;
      assert.equal(times, 7);
      done();
    }

    var signal = appstate.create([
      syncWithoutOutputFirst,
      syncWithOutput, {
        success: [
          successSync
        ]
      },
      syncWithoutOutputSecond,
      [
        async, {
        success: [
            successAsync
          ]
        }
      ],
      syncFinal
    ]);

    signal(store);
  });

  lab.test('must pass and extend args thru all actions', function (done) {
    function async ({ args, output }) {
      assert(args.sync);
      output.success({ async: 'async' });
    }

    function sync ({ args, output }) {
      assert(args.test);
      output({ sync: 'sync'});
    }

    function success ({ args }) {
      assert(args.async);
      assert(args.test);
      assert(args.sync);
      done();
    }

    var signal = appstate.create([
      sync,
      [
        async, {
          success: [success]
        }
      ]
    ]);

    signal(store, {}, { test: 'test' });
  });

  lab.test('Deep async actions must run correctly', function (done) {
    function async ({ output }) {
      output.success();
    }

    function sync ({ output }) {
      output.success();
    }

    function success () {
      done();
    }

    function successSync ({ args }) {
      assert(args);
    }

    var signal = appstate.create([
      [
        async, {
          success: [
            sync, {
              success: [
                successSync
              ]
            },
            [
              async, {
                success: [
                  success
                ]
              }
            ]
          ]
        }
      ]
    ]);

    signal(store);
  });

  lab.test('Should run output actions when ready parent action in async concurrence run', function (done) {
    var times = 0;

    function slow ({ output }) {
      setTimeout(function () {
        output.success();
      }, 10);
    }

    function fast ({ output }) {
      setTimeout(function () {
        output.success();
      }, 0);
    }

    function slowSuccess () {
      times += 1;
      assert.equal(times, 2);
      done();
    }

    function fastSuccess () {
      times += 1;
      assert.equal(times, 1);
    }

    var signal = appstate.create([
      [
        slow, {
          success: [
            slowSuccess
          ]
        },
        fast, {
          success: [
            fastSuccess
          ]
        }
      ]
    ]);

    signal(store);
  });

  lab.test('should can output from sync to async action', function (done) {
    function sync ({ output }) {
      output.success();
    }

    function async ({ output }) {
      output.success();
    }

    function success () {
      done();
    }

    var signal = appstate.create([
      sync, {
        success: [
          [
            async, {
              success: [
                success
              ]
            }
          ]
        ]
      }
    ]);

    signal(store);
  });

  lab.test('should can pass services as 4 arg', function (done) {
    function sync ({ services }) {
      assert(services.test);
      done();
    }

    var signal = appstate.create([
      sync
    ]);

    signal(store, { test: 'test' });
  });

  lab.test('should reject signal promise if error in sync action', function(done) {
    function syncWithError ({ args, dispatch }) {
      dispatch({
        type: 'SET_PROPERTY',
        name: 'test',
        value: args.undefinedArg.deepArg
      });
    }

    var signal = appstate.create([
      syncWithError
    ]);

    signal(store)
      .catch((e) => {
        assert(e instanceof Error);
        done();
      });
  });

  lab.test('should reject signal promise if error in async action', function(done) {
    function asyncWithError ({ getState }) {
      getState().undefinedArg.deepArg;

      output.success();
    }

    var signal = appstate.create([
      [
        asyncWithError, {
          success: [
            noop
          ]
        }
      ]
    ]);

    signal(store)
      .catch((e) => {
        assert(e instanceof Error);
        done();
      });
  });

  lab.test('should reject signal promise if error in async output action', function(done) {
    function syncWithError ({ getState }) {
      getState().undefinedArg.deepArg;
    }

    function async ({ output }) {
      output.success();
    }

    var signal = appstate.create([
      [
        async,
        {
          success: [
            syncWithError
          ]
        }
      ]
    ]);

    signal(store)
      .catch((e) => {
        assert(e instanceof Error);
        done();
      });
  });

  lab.test('should autobind outputs on async action', (done) => {
    function async ({ output }) {
      output.custom();
    }

    var signal = appstate.create([
      [
        async, {
          custom: [() => done()]
        }
      ]
    ]);

    signal(store);
  });

  lab.test('should autobind outputs on sync action', (done) => {
    function sync ({ output }) {
      output.custom();
    }

    var signal = appstate.create([
      sync, {
        custom: [() => done()]
      }
    ]);

    signal(store);
  });

  lab.test('should throw error, if no executed output in async actions', (done) => {
    function async ({ output }) {
      output.success();
    }

    var signal = appstate.create([
      [
        async, {
          custom: []
        }
      ]
    ]);

    signal(store)
      .catch((e) => {
        assert(e instanceof Error);
        done();
      });
  });

  lab.test('should correct run tree with sync action that output to async', (done) => {
    var counter = 0;

    function async ({ output }) {
      setTimeout(() => {
        counter += 1;
        assert.equal(counter, 1);
        output.success();
      }, 0);
    }

    function sync ({ output }) {
      output.success();
    }

    var signal = appstate.create([
      sync, {
        success: [
          [
            async, {
              success: [noop]
            }
          ]
        ]
      }
    ]);

    signal(store).then(function () {
      counter += 1;
      assert.equal(counter, 2);
      done();
    }).catch(done);
  });

  lab.test('should throw error if function defined in async action is miss', (done) => {
    var asyncActionsGroup = {};

    function async ({ output }) {
      setTimeout(() => {
        output.success();
      }, 0);
    }

    var actions = [
      async, {
        success: [
          [
            asyncActionsGroup.miss, {
            success: [ noop ]
          }
          ]
        ]
      }
    ];

    assert.throws(appstate.create.bind(null, [actions]), Error);
    done();
  });

  lab.test('should throw error if function defined in sync action is miss', (done) => {
    var syncActionsGroup = {};

    function sync ({ output }) {
      output.success();
    }

    var actions = [
      sync, {
        success: [
          syncActionsGroup.miss, {
            success: [ noop ]
          }
        ]
      }
    ];

    assert.throws(appstate.create.bind(null, actions), Error);
    done();
  });

  lab.test('should use history in async actions if it passed', (done) => {
    var counter1 = 0;
    var counter2 = 0;
    var outputTimes1 = 0;
    var outputTimes2 = 0;

    function async ({ output }) {
      counter1 += 1;
      output.success({ test: 'test' });
    }

    function sync ({ args }) {
      assert(args.test);
      outputTimes1 += 1;
    }

    function async2 ({ output }) {
      counter2 += 1;
      output.success({ test2: 'test' });
    }

    function sync2 ({ args }) {
      assert(args.test2);
      outputTimes2 += 1;
    }

    var signal = appstate.create([
      [
        async, {
          success: [
            sync
          ]
        },
        async2, {
          success: [
            sync2
          ]
        }
      ]
    ]);

    signal(store)
      .then((result) => {
        return signal(store, {}, {}, result.asyncActionResults);
      })
      .then(() => {
        assert.equal(counter1, 1);
        assert.equal(counter2, 1);
        assert.equal(outputTimes1, 2);
        assert.equal(outputTimes2, 2);

        done();
      })
      .catch(done);
  });
});
