var Lab = require('lab');
var lab = exports.lab = Lab.script();
var assert = require('assert');
var { createStore, applyMiddleware } = require('redux');
var configureMiddleware = require('../../src/middleware');
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

lab.experiment('#middleware', () => {
  var store;

  lab.beforeEach((done) => {
    store = createStore(reducer, applyMiddleware(configureMiddleware()))

    done();
  })

  lab.test('should allow to pass args as second argument', (done) => {
    const passedArgs = {
      hello: 'world',
    }

    function sync ({ args }) {
      assert.deepEqual(passedArgs, args);

      done();
    }

    store.dispatch([ sync ], passedArgs);
  });

  lab.test('should access to state changes in next sync action', (done) => {
    function syncSet ({ dispatch }) {
      dispatch({
        type: 'SET_PROPERTY',
        name: 'hello',
        value: 'world'
      });
    }

    function syncGet ({ getState }) {
      assert.equal(getState().hello, 'world');

      done();
    }

    store.dispatch([
      syncSet,
      syncGet
    ]);
  });

  lab.test('should access to state changes in next async action', (done) => {
    function syncSet ({ dispatch }) {
      dispatch({
        type: 'SET_PROPERTY',
        name: 'hello',
        value: 'world'
      });
    }

    function asyncGet ({ getState, output }) {
      assert.equal(getState().hello, 'world');

      output.success();
    }

    store.dispatch([
      syncSet,
      [
        asyncGet, {
          success: [
            () => done()
          ]
        }
      ]
    ]);
  });
});

