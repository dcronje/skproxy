import http from 'http';
import httpProxy from 'http-proxy';
import path from 'path';
import fs from 'fs';
import jsonSchema from 'jsonschema';
import * as _ from 'underscore';
import Promise from 'bluebird';
import chalk from 'chalk';

let jsonVal = jsonSchema.validate;

//TODO: add target to proxy (get rid of proxy.proxy.options.target.host) object manually assign target proxy server and set up try catch / on error
class SkProxy {

	listeningPort = null;
	proxies = [];
	server = null;
	schemaDir = '';

	constructor(port = 80) {
		this.listeningPort = port;
		this.schemaDir = path.resolve(__dirname, '../../', 'schema');
	}

	startServer() {
		return new Promise((resolve, reject) => {
			this.server = http.createServer((req ,res) => {
				var proxy = _.find(this.proxies, (proxyItem) => {
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
					console.log(chalk.yellow('[WARNING]')+' Unable to proxy: '+req.headers.host+':'+this.listeningPort);
				}
			});
			this.server.on('upgrade', (req, socket, head) => {
				var proxy = _.find(this.proxies, (proxyItem) => {
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
					console.log(chalk.yellow('[WARNING]')+' Unable to proxy: '+req.headers.host+':'+this.listeningPort+' (socket)');
				}
			});
			console.log(chalk.blue('[MESSAGE]')+' Starting proxy server on port: '+this.listeningPort);
			this.server.listen(this.listeningPort);
			resolve();
		});
	}

	loadConfig(jsonConf) {
		return new Promise((resolve, reject) => {
			if (!jsonConf || !jsonConf instanceof Object) {
				return reject(new Error('Missing config object'));
			}
			var proxyConf = jsonConf;
			var schemaFile = path.resolve(this.schemaDir, './configSchema.json');
			var schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
			var errors = jsonVal(proxyConf, schema).errors;
			if (errors.length) {
				var errorString = 'Invalid json object, the following errors were found in your json object: ';
				for (var e = 0; e < errors.length; e ++) {
					errorString += '('+(e + 1)+'): '+errors[e].stack+' ';
				}
				return reject(new Error(errorString));
			}
			Promise.each(proxyConf.proxies, (proxy) => {
				return this.loadProxy(proxy);
			})
			.then(() => {
				resolve();
			})
			.catch(reject);
		});
	}

	loadProxy(proxyConf) {
		return new Promise((resolve, reject) => {
			if (proxyConf.target.port === undefined || proxyConf.target.port == null || parseInt(proxyConf.target.port) < 80) {
				proxyConf.target.port = 80;
			}
			if (proxyConf.listen.port === undefined || proxyConf.listen.port == null || parseInt(proxyConf.listen.port) < 80) {
				proxyConf.listen.port = this.listeningPort;
			}
			var proxy = new httpProxy.createProxyServer({
				target: {
					host: proxyConf.target.host,
					port: proxyConf.target.port
				}
			});
			proxy.on('error', (error, req, res) => {
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
				console.log(error.message+': '+proxyConf.listen.host+':'+proxyConf.listen.port+req.url+' >>> '+proxyConf.target.host+':'+proxyConf.target.port+req.url)
			});
			proxy.on('proxyRes', (proxyRes, req, res) => {
				console.log(chalk.blue('[MESSAGE]')+' Proxied: '+proxyConf.listen.host+':'+proxyConf.listen.port+req.url+' >>> '+proxyConf.target.host+':'+proxyConf.target.port+req.url)
			});
			var proxyItem = {
				proxy: proxy,
				listen: proxyConf.listen,
				target: proxyConf.target
			};
			this.proxies.push(proxyItem);
			console.log(chalk.blue('[MESSAGE]')+' Started proxy: '+proxyConf.listen.host+':'+proxyConf.listen.port+' >>> '+proxyConf.target.host+':'+proxyConf.target.port);
			resolve();
		});
	}
}

process.on('SIGINT', () => {
	console.log("\n");
	console.log(chalk.yellow('[WARNING]')+' Stopping proxy server on port: '+proxy.listeningPort, () => {
		process.exit(0);
	});
});

export default SkProxy;
