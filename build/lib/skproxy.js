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

		this.listeningPort = port;
		this.schemaDir = _path2.default.resolve(__dirname, '../../', 'schema');
	}

	_createClass(SkProxy, [{
		key: 'startServer',
		value: function startServer() {
			var _this = this;

			return new _bluebird2.default(function (resolve, reject) {
				_this.server = _http2.default.createServer(function (req, res) {
					var proxy = _.find(_this.proxies, function (proxyItem) {
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
						console.log(_chalk2.default.yellow('[WARNING]') + ' Unable to proxy: ' + req.headers.host + ':' + _this.listeningPort);
					}
				});
				_this.server.on('upgrade', function (req, socket, head) {
					var proxy = _.find(_this.proxies, function (proxyItem) {
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
						console.log(_chalk2.default.yellow('[WARNING]') + ' Unable to proxy: ' + req.headers.host + ':' + _this.listeningPort + ' (socket)');
					}
				});
				console.log(_chalk2.default.blue('[MESSAGE]') + ' Starting proxy server on port: ' + _this.listeningPort);
				_this.server.listen(_this.listeningPort);
				resolve();
			});
		}
	}, {
		key: 'loadConfig',
		value: function loadConfig(jsonConf) {
			var _this2 = this;

			return new _bluebird2.default(function (resolve, reject) {
				if (!jsonConf || !jsonConf instanceof Object) {
					return reject(new Error('Missing config object'));
				}
				var proxyConf = jsonConf;
				var schemaFile = _path2.default.resolve(_this2.schemaDir, './configSchema.json');
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
					return _this2.loadProxy(proxy);
				}).then(function () {
					resolve();
				}).catch(reject);
			});
		}
	}, {
		key: 'loadProxy',
		value: function loadProxy(proxyConf) {
			var _this3 = this;

			return new _bluebird2.default(function (resolve, reject) {
				if (proxyConf.target.port === undefined || proxyConf.target.port == null || parseInt(proxyConf.target.port) < 80) {
					proxyConf.target.port = 80;
				}
				if (proxyConf.listen.port === undefined || proxyConf.listen.port == null || parseInt(proxyConf.listen.port) < 80) {
					proxyConf.listen.port = _this3.listeningPort;
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
					log.error(_error + ': ' + proxyConf.listen.host + ':' + proxyConf.listen.port + req.url + ' >>> ' + proxyConf.target.host + ':' + proxyConf.target.port + req.url);
				});
				proxy.on('proxyRes', function (proxyRes, req, res) {
					console.log(_chalk2.default.blue('[MESSAGE]') + ' Proxied: ' + proxyConf.listen.host + ':' + proxyConf.listen.port + req.url + ' >>> ' + proxyConf.target.host + ':' + proxyConf.target.port + req.url);
				});
				var proxyItem = {
					proxy: proxy,
					listen: proxyConf.listen,
					target: proxyConf.target
				};
				_this3.proxies.push(proxyItem);
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