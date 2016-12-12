'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _httpProxy = require('http-proxy');

var _httpProxy2 = _interopRequireDefault(_httpProxy);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _jsonschema = require('jsonschema');

var _jsonschema2 = _interopRequireDefault(_jsonschema);

var _underscore = require('underscore');

var _ = _interopRequireWildcard(_underscore);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var jsonVal = _jsonschema2.default.validate;

//TODO: add target to proxy (get rid of proxy.proxy.options.target.host) object manually assign target proxy server and set up try catch / on error

var SkProxy = function () {
  function SkProxy() {
    var port = arguments.length <= 0 || arguments[0] === undefined ? 80 : arguments[0];

    _classCallCheck(this, SkProxy);

    this.listeningPort = null;
    this.proxies = [];
    this.server = null;
    this.schemaDir = '';
    this.configDir = false;

    this.listeningPort = port;
    this.schemaDir = _path2.default.resolve(__dirname, '../../', 'schema');
  }

  _createClass(SkProxy, [{
    key: 'start',
    value: function start() {
      var _this = this;

      if (this.configDir) {
        this.loadConfigDirectory().then(function () {
          _this.startServer();
        }).catch(function (err) {
          console.log(err.stack);
        });
      } else {
        this.startServer();
      }
    }
  }, {
    key: 'startServer',
    value: function startServer() {
      var _this2 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this2.server = _http2.default.createServer(function (req, res) {
          var proxy = _.find(_this2.proxies, function (proxyItem) {
            var reqUri = req.headers.host.split(':')[0];
            return proxyItem.listen.host == reqUri;
          });
          if (proxy) {
            proxy.proxy.web(req, res);
          } else {
            var responseObject = JSON.stringify({
              success: false,
              message: 'Api/Site not found',
              data: false
            });
            res.writeHead(404, {
              'Content-Length': responseObject.length,
              'Content-Type': 'application/json'
            });
            res.write(responseObject);
            res.end();
            console.log(_chalk2.default.yellow('[WARNING]') + ' Unable to proxy: ' + req.headers.host + ':' + _this2.listeningPort);
          }
        });
        _this2.server.on('upgrade', function (req, socket, head) {
          var proxy = _.find(_this2.proxies, function (proxyItem) {
            var reqUri = req.headers.host.split(':')[0];
            return proxyItem.listen.host == reqUri;
          });
          if (proxy) {
            proxy.proxy.ws(req, socket, head);
          } else {
            var responseObject = JSON.stringify({
              success: false,
              message: 'Api/Site not found',
              data: false
            });
            res.writeHead(404, {
              'Content-Length': responseObject.length,
              'Content-Type': 'application/json'
            });
            res.write(responseObject);
            res.end();
            console.log(_chalk2.default.yellow('[WARNING]') + ' Unable to proxy: ' + req.headers.host + ':' + _this2.listeningPort + ' (socket)');
          }
        });
        console.log(_chalk2.default.blue('[MESSAGE]') + ' Starting proxy server on port: ' + _this2.listeningPort);
        _this2.server.listen(_this2.listeningPort);
        resolve();
      });
    }
  }, {
    key: 'reloadServer',
    value: function reloadServer() {
      var _this3 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _.each(_this3.proxies, function (proxyService) {
          proxyService.proxy.close();
          console.log(_chalk2.default.blue('[MESSAGE]') + ' Stopped proxy: ' + proxyService.listen.host + ':' + proxyService.listen.port + ' >>> ' + proxyService.target.host + ':' + proxyService.target.port);
        });
        _this3.proxies = [];
        _this3.loadConfigDirectory().then(function (proxies) {
          _.each(proxies, function (proxy) {
            _this3.loadProxy(proxy);
          });
        });
      });
    }
  }, {
    key: 'setConfiDirectory',
    value: function setConfiDirectory(directory) {
      this.configDir = directory;
    }
  }, {
    key: 'loadConfigDirectory',
    value: function loadConfigDirectory() {
      var _this4 = this;

      return new _bluebird2.default(function (resolve, reject) {
        _this4.readConfigDirectory().then(function (proxies) {
          return _this4.loadConfig({
            proxies: proxies
          });
        }).then(function () {
          // fs.watch(this.configDir, {encoding: 'utf-8'}, (eventType, filename) => {
          //   console.log(filename, eventType);
          //   this.reloadServer();
          // });
          resolve();
        }).catch(reject);
      });
    }
  }, {
    key: 'readConfigDirectory',
    value: function readConfigDirectory() {
      var _this5 = this;

      return new _bluebird2.default(function (resolve, reject) {
        var proxies = [];
        _fs2.default.readdir(_this5.configDir, function (err, files) {
          _bluebird2.default.each(files, function (file) {
            return new _bluebird2.default(function (resolve, reject) {
              var filePath = _path2.default.join(_this5.configDir, file);
              _this5.validateConfigFile(filePath).then(function (fileData) {
                if (fileData) {
                  fileData.file = file;
                  proxies.push(fileData);
                }
                resolve();
              }).catch(reject);
            });
          }).then(function () {
            console.log(proxies);
            resolve(proxies);
          }).catch(reject);
        });
      });
    }
  }, {
    key: 'validateConfigFile',
    value: function validateConfigFile(file) {
      var _this6 = this;

      return new _bluebird2.default(function (resolve, reject) {
        if (file.indexOf('.json') == -1) {
          return resolve(false);
        }
        _fs2.default.stat(file, function (err, stats) {
          if (err) {
            reject(err);
          };
          if (stats.isFile()) {
            _this6.readFile(file).then(function (fileData) {
              resolve(fileData);
            }).catch(function (err) {
              console.log(_chalk2.default.red('[ ERROR ]') + ': Invalid proxy config ' + file);
              resolve(false);
            });
          } else {
            return resolve(false);
          }
        });
      });
    }
  }, {
    key: 'readFile',
    value: function readFile(file) {
      return new _bluebird2.default(function (resolve, reject) {
        _fs2.default.readFile(file, 'utf-8', function (err, fileData) {
          if (err) {
            return reject(err);
          }
          try {
            var jsonFileData = JSON.parse(fileData);
            resolve(jsonFileData);
          } catch (e) {
            return reject(e);
          }
        });
      });
    }
  }, {
    key: 'loadConfig',
    value: function loadConfig(jsonConf) {
      var _this7 = this;

      return new _bluebird2.default(function (resolve, reject) {
        if (!jsonConf || !jsonConf instanceof Object) {
          return reject(new Error('Missing config object'));
        }
        var proxyConf = jsonConf;
        var schemaFile = _path2.default.resolve(_this7.schemaDir, './configSchema.json');
        var schema = JSON.parse(_fs2.default.readFileSync(schemaFile, 'utf-8'));
        var errors = jsonVal(proxyConf, schema).errors;
        if (errors.length) {
          var errorString = 'Invalid json object, the following errors were found in your json object: ';
          for (var e = 0; e < errors.length; e++) {
            errorString += '(' + (e + 1) + '): ' + errors[e].stack + ' ';
          }
          return reject(new Error(errorString));
        }
        _bluebird2.default.each(proxyConf.proxies, function (proxy) {
          return _this7.loadProxy(proxy);
        }).then(function () {
          resolve();
        }).catch(reject);
      });
    }
  }, {
    key: 'loadProxy',
    value: function loadProxy(proxyConf) {
      var _this8 = this;

      return new _bluebird2.default(function (resolve, reject) {
        if (proxyConf.target.port === undefined || proxyConf.target.port == null || parseInt(proxyConf.target.port) < 80) {
          proxyConf.target.port = 80;
        }
        if (proxyConf.listen.port === undefined || proxyConf.listen.port == null || parseInt(proxyConf.listen.port) < 80) {
          proxyConf.listen.port = _this8.listeningPort;
        }
        var proxy = new _httpProxy2.default.createProxyServer({
          target: {
            host: proxyConf.target.host,
            port: proxyConf.target.port
          }
        });
        proxy.on('error', function (error, req, res) {
          var responseObject = JSON.stringify({
            success: false,
            message: error,
            data: false
          });
          res.writeHead(404, {
            'Content-Length': responseObject.length,
            'Content-Type': 'application/json'
          });
          res.write(responseObject);
          res.end();
          console.log(_chalk2.default.red('[ ERROR ]') + ': ' + proxyConf.listen.host + ':' + (proxyConf.listen.port + req.url) + ' >>> ' + proxyConf.target.host + ':' + (proxyConf.target.port + req.url));
        });
        proxy.on('proxyRes', function (proxyRes, req, res) {
          console.log(_chalk2.default.blue('[MESSAGE]') + ' Proxied: ' + proxyConf.listen.host + ':' + (proxyConf.listen.port + req.url) + ' >>> ' + proxyConf.target.host + ':' + (proxyConf.target.port + req.url));
        });
        var proxyItem = {
          proxy: proxy,
          listen: proxyConf.listen,
          target: proxyConf.target,
          file: proxyConf.file
        };
        _this8.proxies.push(proxyItem);
        console.log(_chalk2.default.blue('[MESSAGE]') + ' Started proxy: ' + proxyConf.listen.host + ':' + proxyConf.listen.port + ' >>> ' + proxyConf.target.host + ':' + proxyConf.target.port);
        resolve();
      });
    }
  }]);

  return SkProxy;
}();

process.on('SIGINT', function () {
  console.log("\n");
  console.log(_chalk2.default.yellow('[WARNING]') + ' Stopping proxy server on port: ' + proxy.listeningPort, function () {
    process.exit(0);
  });
});

exports.default = SkProxy;
//# sourceMappingURL=skproxy.js.map