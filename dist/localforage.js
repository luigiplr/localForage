/*!
    localForage -- Offline Storage, Improved
    Version 1.7.1
    https://localforage.github.io/localForage
    (c) 2013-2017 Mozilla, Apache License 2.0
*/
/*!
    localForage -- Offline Storage, Improved
    Version 1.7.1
    https://localforage.github.io/localForage
    (c) 2013-2017 Mozilla, Apache License 2.0
*/
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define('localforage', ['exports', './utils/isIndexedDBValid', './utils/isWebSQLValid', './utils/isLocalStorageValid', './drivers/indexeddb', './drivers/websql', './drivers/localstorage', './utils/serializer', './utils/promise', './utils/executeTwoCallbacks'], factory);
    } else if (typeof exports !== "undefined") {
        factory(exports, require('./utils/isIndexedDBValid'), require('./utils/isWebSQLValid'), require('./utils/isLocalStorageValid'), require('./drivers/indexeddb'), require('./drivers/websql'), require('./drivers/localstorage'), require('./utils/serializer'), require('./utils/promise'), require('./utils/executeTwoCallbacks'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports, global.isIndexedDBValid, global.isWebSQLValid, global.isLocalStorageValid, global.indexeddb, global.websql, global.localstorage, global.serializer, global.promise, global.executeTwoCallbacks);
        global.localforage = mod.exports;
    }
})(this, function (exports, _isIndexedDBValid, _isWebSQLValid, _isLocalStorageValid, _indexeddb, _websql, _localstorage, _serializer, _promise, _executeTwoCallbacks) {
    'use strict';

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.LocalForage = undefined;

    var _isIndexedDBValid2 = _interopRequireDefault(_isIndexedDBValid);

    var _isWebSQLValid2 = _interopRequireDefault(_isWebSQLValid);

    var _isLocalStorageValid2 = _interopRequireDefault(_isLocalStorageValid);

    var _indexeddb2 = _interopRequireDefault(_indexeddb);

    var _websql2 = _interopRequireDefault(_websql);

    var _localstorage2 = _interopRequireDefault(_localstorage);

    var _serializer2 = _interopRequireDefault(_serializer);

    var _promise2 = _interopRequireDefault(_promise);

    var _executeTwoCallbacks2 = _interopRequireDefault(_executeTwoCallbacks);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            "default": obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    // Custom drivers are stored here when `defineDriver()` is called.
    // They are shared across all instances of localForage.
    var CustomDrivers = {};

    var DriverType = {
        INDEXEDDB: 'asyncStorage',
        LOCALSTORAGE: 'localStorageWrapper',
        WEBSQL: 'webSQLStorage'
    };

    var DefaultDriverOrder = [DriverType.INDEXEDDB, DriverType.WEBSQL, DriverType.LOCALSTORAGE];

    var LibraryMethods = ['clear', 'getItem', 'iterate', 'key', 'keys', 'length', 'removeItem', 'setItem'];

    var DefaultConfig = {
        description: '',
        driver: DefaultDriverOrder.slice(),
        name: 'localforage',
        // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
        // we can use without a prompt.
        size: 4980736,
        storeName: 'keyvaluepairs',
        version: 1.0
    };

    var driverSupport = {};
    // Check to see if IndexedDB is available and if it is the latest
    // implementation; it's our preferred backend library. We use "_spec_test"
    // as the name of the database because it's not the one we'll operate on,
    // but it's useful to make sure its using the right spec.
    // See: https://github.com/mozilla/localForage/issues/128
    driverSupport[DriverType.INDEXEDDB] = (0, _isIndexedDBValid2["default"])();

    driverSupport[DriverType.WEBSQL] = (0, _isWebSQLValid2["default"])();

    driverSupport[DriverType.LOCALSTORAGE] = (0, _isLocalStorageValid2["default"])();

    var isArray = Array.isArray || function (arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };

    function callWhenReady(localForageInstance, libraryMethod) {
        localForageInstance[libraryMethod] = function () {
            var _args = arguments;
            return localForageInstance.ready().then(function () {
                return localForageInstance[libraryMethod].apply(localForageInstance, _args);
            });
        };
    }

    function extend() {
        for (var i = 1; i < arguments.length; i++) {
            var arg = arguments[i];

            if (arg) {
                for (var key in arg) {
                    if (arg.hasOwnProperty(key)) {
                        if (isArray(arg[key])) {
                            arguments[0][key] = arg[key].slice();
                        } else {
                            arguments[0][key] = arg[key];
                        }
                    }
                }
            }
        }

        return arguments[0];
    }

    function isLibraryDriver(driverName) {
        for (var driver in DriverType) {
            if (DriverType.hasOwnProperty(driver) && DriverType[driver] === driverName) {
                return true;
            }
        }

        return false;
    }

    var LocalForage = exports.LocalForage = function () {
        function LocalForage(options) {
            _classCallCheck(this, LocalForage);

            this.INDEXEDDB = DriverType.INDEXEDDB;
            this.LOCALSTORAGE = DriverType.LOCALSTORAGE;
            this.WEBSQL = DriverType.WEBSQL;

            this._defaultConfig = extend({}, DefaultConfig);
            this._config = extend({}, this._defaultConfig, options);
            this._driverSet = null;
            this._initDriver = null;
            this._ready = false;
            this._dbInfo = null;

            this._wrapLibraryMethodsWithReady();
            this.setDriver(this._config.driver)["catch"](function () {});
        }

        // Set any config values for localForage; can be called anytime before
        // the first API call (e.g. `getItem`, `setItem`).
        // We loop through options so we don't overwrite existing config
        // values.


        LocalForage.prototype.config = function config(options) {
            // If the options argument is an object, we use it to set values.
            // Otherwise, we return either a specified config value or all
            // config values.
            if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object') {
                // If localforage is ready and fully initialized, we can't set
                // any new configuration values. Instead, we return an error.
                if (this._ready) {
                    return new Error("Can't call config() after localforage " + 'has been used.');
                }

                for (var i in options) {
                    if (i === 'storeName') {
                        options[i] = options[i].replace(/\W/g, '_');
                    }

                    if (i === 'version' && typeof options[i] !== 'number') {
                        return new Error('Database version must be a number.');
                    }

                    this._config[i] = options[i];
                }

                // after all config options are set and
                // the driver option is used, try setting it
                if ('driver' in options && options.driver) {
                    return this.setDriver(this._config.driver);
                }

                return true;
            } else if (typeof options === 'string') {
                return this._config[options];
            } else {
                return this._config;
            }
        };

        // Used to define a custom driver, shared across all instances of
        // localForage.


        LocalForage.prototype.defineDriver = function defineDriver(driverObject, callback, errorCallback) {
            var promise = new _promise2["default"](function (resolve, reject) {
                try {
                    var driverName = driverObject._driver;
                    var complianceError = new Error('Custom driver not compliant; see ' + 'https://mozilla.github.io/localForage/#definedriver');
                    var namingError = new Error('Custom driver name already in use: ' + driverObject._driver);

                    // A driver name should be defined and not overlap with the
                    // library-defined, default drivers.
                    if (!driverObject._driver) {
                        reject(complianceError);
                        return;
                    }
                    if (isLibraryDriver(driverObject._driver)) {
                        reject(namingError);
                        return;
                    }

                    var customDriverMethods = LibraryMethods.concat('_initStorage');
                    for (var i = 0; i < customDriverMethods.length; i++) {
                        var customDriverMethod = customDriverMethods[i];
                        if (!customDriverMethod || !driverObject[customDriverMethod] || typeof driverObject[customDriverMethod] !== 'function') {
                            reject(complianceError);
                            return;
                        }
                    }

                    var setDriverSupport = function setDriverSupport(support) {
                        driverSupport[driverName] = support;
                        CustomDrivers[driverName] = driverObject;
                        resolve();
                    };

                    if ('_support' in driverObject) {
                        if (driverObject._support && typeof driverObject._support === 'function') {
                            driverObject._support().then(setDriverSupport, reject);
                        } else {
                            setDriverSupport(!!driverObject._support);
                        }
                    } else {
                        setDriverSupport(true);
                    }
                } catch (e) {
                    reject(e);
                }
            });

            (0, _executeTwoCallbacks2["default"])(promise, callback, errorCallback);
            return promise;
        };

        LocalForage.prototype.driver = function driver() {
            return this._driver || null;
        };

        LocalForage.prototype.getDriver = function getDriver(driverName, callback, errorCallback) {
            var self = this;
            var getDriverPromise = _promise2["default"].resolve().then(function () {
                if (isLibraryDriver(driverName)) {
                    switch (driverName) {
                        case self.INDEXEDDB:
                            return _indexeddb2["default"];
                        case self.LOCALSTORAGE:
                            return _localstorage2["default"];
                        case self.WEBSQL:
                            return _websql2["default"];
                    }
                } else if (CustomDrivers[driverName]) {
                    return CustomDrivers[driverName];
                } else {
                    throw new Error('Driver not found.');
                }
            });
            (0, _executeTwoCallbacks2["default"])(getDriverPromise, callback, errorCallback);
            return getDriverPromise;
        };

        LocalForage.prototype.getSerializer = function getSerializer(callback) {
            var serializerPromise = _promise2["default"].resolve(_serializer2["default"]);
            (0, _executeTwoCallbacks2["default"])(serializerPromise, callback);
            return serializerPromise;
        };

        LocalForage.prototype.ready = function ready(callback) {
            var self = this;

            var promise = self._driverSet.then(function () {
                if (self._ready === null) {
                    self._ready = self._initDriver();
                }

                return self._ready;
            });

            (0, _executeTwoCallbacks2["default"])(promise, callback, callback);
            return promise;
        };

        LocalForage.prototype.setDriver = function setDriver(drivers, callback, errorCallback) {
            var self = this;

            if (!isArray(drivers)) {
                drivers = [drivers];
            }

            var supportedDrivers = this._getSupportedDrivers(drivers);

            function setDriverToConfig() {
                self._config.driver = self.driver();
            }

            function extendSelfWithDriver(driver) {
                self._extend(driver);
                setDriverToConfig();

                self._ready = self._initStorage(self._config);
                return self._ready;
            }

            function initDriver(supportedDrivers) {
                return function () {
                    var currentDriverIndex = 0;

                    function driverPromiseLoop() {
                        while (currentDriverIndex < supportedDrivers.length) {
                            var driverName = supportedDrivers[currentDriverIndex];
                            currentDriverIndex++;

                            self._dbInfo = null;
                            self._ready = null;

                            return self.getDriver(driverName).then(extendSelfWithDriver)["catch"](driverPromiseLoop);
                        }

                        setDriverToConfig();
                        var error = new Error('No available storage method found.');
                        self._driverSet = _promise2["default"].reject(error);
                        return self._driverSet;
                    }

                    return driverPromiseLoop();
                };
            }

            // There might be a driver initialization in progress
            // so wait for it to finish in order to avoid a possible
            // race condition to set _dbInfo
            var oldDriverSetDone = this._driverSet !== null ? this._driverSet["catch"](function () {
                return _promise2["default"].resolve();
            }) : _promise2["default"].resolve();

            this._driverSet = oldDriverSetDone.then(function () {
                var driverName = supportedDrivers[0];
                self._dbInfo = null;
                self._ready = null;

                return self.getDriver(driverName).then(function (driver) {
                    self._driver = driver._driver;
                    setDriverToConfig();
                    self._wrapLibraryMethodsWithReady();
                    self._initDriver = initDriver(supportedDrivers);
                });
            })["catch"](function () {
                setDriverToConfig();
                var error = new Error('No available storage method found.');
                self._driverSet = _promise2["default"].reject(error);
                return self._driverSet;
            });

            (0, _executeTwoCallbacks2["default"])(this._driverSet, callback, errorCallback);
            return this._driverSet;
        };

        LocalForage.prototype.supports = function supports(driverName) {
            return !!driverSupport[driverName];
        };

        LocalForage.prototype._extend = function _extend(libraryMethodsAndProperties) {
            extend(this, libraryMethodsAndProperties);
        };

        LocalForage.prototype._getSupportedDrivers = function _getSupportedDrivers(drivers) {
            var supportedDrivers = [];
            for (var i = 0, len = drivers.length; i < len; i++) {
                var driverName = drivers[i];
                if (this.supports(driverName)) {
                    supportedDrivers.push(driverName);
                }
            }
            return supportedDrivers;
        };

        LocalForage.prototype._wrapLibraryMethodsWithReady = function _wrapLibraryMethodsWithReady() {
            // Add a stub for each driver API method that delays the call to the
            // corresponding driver method until localForage is ready. These stubs
            // will be replaced by the driver methods as soon as the driver is
            // loaded, so there is no performance impact.
            for (var i = 0; i < LibraryMethods.length; i++) {
                callWhenReady(this, LibraryMethods[i]);
            }
        };

        LocalForage.prototype.createInstance = function createInstance(options) {
            return new LocalForage(options);
        };

        return LocalForage;
    }();

    exports["default"] = new LocalForage();
});
