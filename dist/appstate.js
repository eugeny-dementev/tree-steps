'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

module.exports = {
  /**
   * Signal factory. Create signal functions with deep analyzed structure.
   * Every signal run, have full meta information about every action called within signal.
   * Before create, signal will be analyzed for correct definition.
   *
   * @example:
   *  var actions = [
   *    syncAction,
   *    [
   *      asyncAction,
   *      {
   *        success: [successSyncAction],
   *        error: [errorSyncAction]
   *      }
   *    ]
   *  ];
   *
   *  const signal = appstate.create(actions);
   *  const store = createReduxStore(reducer);
   *
   *  // You can run signal as function that return Promise with results
   *  signal(store);
   *
   * That have 1 args with properties: signalArgs, getState, output, dispatch, services.
   * All args passed automatically when you run signal.
   *
   * @param {Array} actions
   * @return {Function}
   */
  create: function create(actions) {
    analyze(actions);

    return function (store) {
      var services = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var args = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var asyncActionResults = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

      return new Promise(function (resolve, reject) {
        var promise = { resolve: resolve, reject: reject };
        var start = Date.now();

        checkArgs(args, promise);
        // Transform signal definition to flatten array
        var tree = staticTree(actions);

        // Create signal definition
        var signal = {
          args: args,
          asyncActionResults: asyncActionResults,
          branches: tree.branches,
          isExecuting: true,
          duration: 0
        };

        // Start recursive run tree branches
        runBranch(0, { tree: tree, args: args, signal: signal, promise: promise, start: start, store: store, services: services });
      });
    };
  }
};

/**
 * Run tree branch, or resolve signal
 * if no more branches in recursion.
 * @param {Number} index
 * @param {Object} options
 * @param {Object} options.tree
 * @param {Object} options.args
 * @param {Object} options.signal
 * @param {Object} options.promise
 * @param {Date}   options.start
 * @param {Redux} options.store
 * @param {Object} options.services
 */
function runBranch(index, options) {
  var tree = options.tree,
      signal = options.signal,
      start = options.start,
      promise = options.promise;

  var currentBranch = tree.branches[index];

  if (!currentBranch && tree.branches === signal.branches) {
    if (tree.branches[index - 1]) {
      tree.branches[index - 1].duration = Date.now() - start;
    }

    signal.isExecuting = false;

    if (promise) {
      promise.resolve(signal);
    }

    return;
  }

  if (!currentBranch) {
    return;
  }

  if (Array.isArray(currentBranch)) {
    return runAsyncBranch(index, currentBranch, options);
  } else {
    return runSyncBranch(index, currentBranch, options);
  }
}

/**
 * Run async branch
 * @param {Number} index
 * @param {Object} currentBranch
 * @param {Object} options
 * @param {Object} options.tree
 * @param {Object} options.args
 * @param {Object} options.signal
 * @param {Object} options.promise
 * @param {Date}   options.start
 * @param {Redux} options.store
 * @param {Object} options.services
 * @returns {Promise}
 */
function runAsyncBranch(index, currentBranch, options) {
  var tree = options.tree,
      args = options.args,
      signal = options.signal,
      store = options.store,
      promise = options.promise,
      start = options.start,
      services = options.services;


  var promises = currentBranch.map(function (action) {
    var actionFunc = tree.actions[action.actionIndex];
    var actionArgs = createActionArgs(args, store, true);
    var outputs = action.outputs ? Object.keys(action.outputs) : [];

    action.isExecuting = true;
    action.args = merge({}, args);

    var nextActionPromise;
    var foundResult = signal.asyncActionResults.find(function (result) {
      return isEqualArrays(result.outputPath, action.path);
    });

    // If actions results provided, you run it in replay mode
    if (foundResult) {
      nextActionPromise = Promise.resolve(foundResult);
    } else {
      var next = createNextAsyncAction(actionFunc, outputs);
      actionFunc(Object.assign({}, actionArgs, {
        output: next.fn,
        services: services
      }));
      nextActionPromise = next.promise;
    }

    return nextActionPromise.then(function (result) {
      action.hasExecuted = true;
      action.isExecuting = false;
      action.output = result.args;

      // Save short results snippet for replay
      signal.asyncActionResults.push({
        outputPath: action.path,
        path: result.path,
        args: result.args
      });

      merge(args, result.args);

      if (result.path) {
        action.outputPath = result.path;
        var output = action.outputs[result.path];

        return runBranch(0, {
          args: args, signal: signal, store: store, start: start, promise: promise, services: services,
          tree: {
            actions: tree.actions,
            branches: output
          }
        });
      }
    }).catch(function (e) {
      return promise.reject(e);
    });
  });

  return Promise.all(promises).then(function () {
    return runBranch(index + 1, options);
  });
}

/**
 * Run sync branch
 * @param {Number} index
 * @param {Object} currentBranch
 * @param {Object} options
 * @param {Object} options.tree
 * @param {Object} options.args
 * @param {Object} options.signal
 * @param {Object} options.promise
 * @param {Date}   options.start
 * @param {Redux} options.store
 * @param {Object} options.services
 * @returns {Promise|undefined}
 */
function runSyncBranch(index, currentBranch, options) {
  var args = options.args,
      tree = options.tree,
      signal = options.signal,
      store = options.store,
      start = options.start,
      promise = options.promise,
      services = options.services;


  try {
    var action = currentBranch;
    var actionFunc = tree.actions[action.actionIndex];
    var actionArgs = createActionArgs(args, store, false);
    var outputs = action.outputs ? Object.keys(action.outputs) : [];

    action.args = merge({}, args);

    var next = createNextSyncAction(actionFunc, outputs);
    actionFunc(Object.assign({}, actionArgs, {
      output: next,
      services: services
    }));

    var result = next._result || {};
    merge(args, result.args);

    action.isExecuting = false;
    action.hasExecuted = true;
    action.output = result.args;

    if (result.path) {
      action.outputPath = result.path;
      var output = action.outputs[result.path];

      var runResult = runBranch(0, {
        args: args, signal: signal, store: store, start: start, promise: promise, services: services,
        tree: {
          actions: tree.actions,
          branches: output
        }
      });

      if (runResult && runResult.then) {
        return runResult.then(function () {
          return runBranch(index + 1, options);
        });
      }

      return runBranch(index + 1, options);
    }
    return runBranch(index + 1, options);
  } catch (e) {
    promise.reject(e);
  }
}

/**
 * Add output paths to next function.
 *
 * Outputs takes from branches tree object.
 * @example:
 *  var actions = [
 *    syncAction,
 *    [
 *      asyncAction,
 *      {
 *        custom1: [custom1SyncAction],
 *        custom2: [custom2SyncAction]
 *      }
 *    ]
 *  ];
 *
 *  function asyncAction ({}, store, output) {
 *    if ( ... ) {
 *      output.custom1();
 *    } else {
 *      output.custom2();
 *    }
 *  }
 *
 * @param {Function} next
 * @param {Array} outputs
 * @returns {*}
 */
function addOutputs(next, outputs) {
  if (Array.isArray(outputs)) {
    outputs.forEach(function (key) {
      next[key] = next.bind(null, key);
    });
  }

  return next;
}

/**
 * Create next function in signal chain.
 * It's unified method for async and sync actions.
 * @param {Function} action
 * @param {Function} [resolver]
 * @returns {Function}
 */
function createNextFunction(action, resolver) {
  return function next() {
    var path = typeof (arguments.length <= 0 ? undefined : arguments[0]) === 'string' ? arguments.length <= 0 ? undefined : arguments[0] : null;
    var arg = path ? arguments.length <= 1 ? undefined : arguments[1] : arguments.length <= 0 ? undefined : arguments[0];

    var result = {
      path: path ? path : action.defaultOutput,
      args: arg
    };

    if (resolver) {
      resolver(result);
    } else {
      next._result = result;
    }
  };
}

/**
 * Create next sync action
 * @param {Function} actionFunc
 * @param {Array} outputs
 * @returns {Function}
 */
function createNextSyncAction(actionFunc, outputs) {
  var next = createNextFunction(actionFunc);
  next = addOutputs(next, outputs);

  return next;
}

/**
 * Create next sync action
 * @param {Function} actionFunc
 * @param {Array} outputs
 * @returns {{}}
 */
function createNextAsyncAction(actionFunc, outputs) {
  var resolver = null;
  var promise = new Promise(function (resolve) {
    return resolver = resolve;
  });
  var fn = createNextFunction(actionFunc, resolver);
  addOutputs(fn, outputs);

  return { fn: fn, promise: promise };
}

/**
 * Create action arguments for every action.
 * State object exposed as special patched collection of
 * mutation/accessors functions of Redux store.
 * @param {*} args
 * @param {Object} action
 * @param {Object} store
 * @param {Boolean} isAsync
 * @returns {Array}
 */
function createActionArgs(args, store, isAsync) {
  return Object.assign({ args: args }, getStoreMethods(store, isAsync));
}

/**
 * Get store mutators and accessors
 * Each mutation will save in action descriptor.
 * This method allow add ability
 * to gather information about call every function.
 * @param {Object} store
 * @param {Object} action
 * @param {Boolean} isAsync
 * @return {Object}
 */
function getStoreMethods(store, isAsync) {
  var methods = null;

  if (isAsync) {
    methods = {
      getState: store.getState
    };
  } else {
    methods = {
      getState: store.getState,
      dispatch: function dispatch(action) {
        if (Object.prototype.toString.call(action) === "[object Object]" && action.type) {
          return store.dispatch(action);
        }

        throw new Error('Signal actions should dispatch only plain object redux actions');
      }
    };
  }

  return methods;
}

/**
 * Transform signal actions to static tree.
 * Every function will be exposed as object definition,
 * that will store meta information and function call results.
 * @param {Array} signalActions
 * @returns {{ actions: [], branches: [] }}
 */
function staticTree(signalActions) {
  var actions = [];
  var branches = transformBranch(signalActions, [], [], actions, false);
  return { actions: actions, branches: branches };
}

/**
 * Transform tree branch
 * @param {Function} action
 * @param {Array}    args
 * @param {Array|Function}    args.parentAction
 * @param {Array}    args.path
 * @param {Array}    args.actions
 * @param {Boolean}  args.isSync
 * @return {Object}
 */
function transformBranch(action) {
  for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  return Array.isArray(action) ? transformAsyncBranch.apply(null, [action].concat(args)) : transformSyncBranch.apply(null, [action].concat(args));
}

/**
 * Transform action to async branch
 * @param {Function} action
 * @param {Array|Function} parentAction
 * @param {Array} path
 * @param {Array} actions
 * @param {Boolean} isSync
 * @returns {*}
 */
function transformAsyncBranch(action, parentAction, path, actions, isSync) {
  action = action.slice();
  isSync = !isSync;
  return action.map(function (subAction, index) {
    path.push(index);
    var result = transformBranch(subAction, action, path, actions, isSync);
    path.pop();
    return result;
  }).filter(function (branch) {
    return !!branch;
  });
}

/**
 * Transform action to sync branch
 * @param {Function} action
 * @param {Array|Function} parentAction
 * @param {Array} path
 * @param {Array} actions
 * @param {Boolean} isSync
 * @returns {{
 *    name: *, args: {}, output: null, duration: number,
 *    isExecuting: boolean, hasExecuted: boolean,
 *    path: *, outputs: null, actionIndex: number
 *  }|undefined}
 */
function transformSyncBranch(action, parentAction, path, actions, isSync) {
  var branch = {
    name: getFunctionName(action),
    args: {},
    output: null,
    duration: 0,
    isAsync: !isSync,
    outputPath: null,
    isExecuting: false,
    hasExecuted: false,
    path: path.slice(),
    outputs: null,
    actionIndex: actions.indexOf(action) === -1 ? actions.push(action) - 1 : actions.indexOf(action)
  };

  var nextAction = parentAction[parentAction.indexOf(action) + 1];
  if (!Array.isArray(nextAction) && (typeof nextAction === 'undefined' ? 'undefined' : _typeof(nextAction)) === 'object') {
    parentAction.splice(parentAction.indexOf(nextAction), 1);

    branch.outputs = Object.keys(nextAction).reduce(function (paths, key) {
      path = path.concat('outputs', key);
      paths[key] = transformBranch(nextAction[key], parentAction, path, actions, false);
      path.pop();
      path.pop();
      return paths;
    }, {});
  }

  return branch;
}

/**
 * Analyze actions for errors
 * @param {Array} actions
 */
function analyze(actions) {
  if (!Array.isArray(actions)) {
    throw new Error('State: Signal actions should be array');
  }

  actions.forEach(function (action, index) {
    if (typeof action === 'undefined' || typeof action === 'string') {
      throw new Error('\n            State: Action number "' + index + '" in signal does not exist.\n            Check that you have spelled it correctly!\n          ');
    }

    if (Array.isArray(action)) {
      analyze(action);
    } else if (Object.prototype.toString.call(action) === "[object Object]") {
      Object.keys(action).forEach(function (output) {
        analyze(action[output]);
      });
    }
  });
}

/**
 * Check arguments
 * @param {*} args
 * @param {Object} promise
 */
function checkArgs(args, promise) {
  try {
    JSON.stringify(args);
  } catch (e) {
    promise.reject('State - Could not serialize arguments to signal. Please check signal.');
  }
}

/**
 * Get function name
 * @param {Function} fn
 * @returns {String}
 */
function getFunctionName(fn) {
  var name = fn.toString();
  name = name.substr('function '.length);
  name = name.substr(0, name.indexOf('('));
  return name;
}

/**
 * Merge two objects
 * @param {Object} target
 * @param {Object} source
 * @returns {Object}
 */
function merge(target, source) {
  source = source || {};
  return Object.keys(source).reduce(function (targetKey, key) {
    targetKey[key] = source[key];
    return target;
  }, target);
}

function isEqualArrays(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second)) {
    return false;
  }

  if (first.length !== second.length) {
    return false;
  }

  return first.every(function (element, index) {
    return element === second[index];
  });
}
