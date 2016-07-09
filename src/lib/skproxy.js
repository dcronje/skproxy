import http from 'http';
import httpProxy from 'http-proxy';
import path from 'path';
import fs from 'fs';
import { vlaidate as jsonVal } from 'jsonschema';
import * as _ from 'underscore';
import Promise from 'bluebird';
import chalk from 'chalk';

//TODO: add target to proxy (get rid of proxy.proxy.options.target.host) object manually assign target proxy server and set up try catch / on error
class SkProxy {

	listeningPort = null;
	proxies = [];
	server = null;

	constructor(port = 80) {
		this.listeningPort = port;
	}

	startServer() {
		return new Promise((resolve, reject) => {
			var schemaDir = path.resolve(path.dirname(module.filename), '../', 'schema');
			this.server = http.createServer((req ,res) => {
				var proxy = _.find(this.proxies, (proxyItem) => {
					var reqUri = req.headers.host.split(':')[0];
					return proxyItem.listen.host == reqUri;
				});
				if (proxy) {
					proxy.proxy.proxyRequest(req, res);
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
					console.log(chalk.yellow('[WARNING]')+' Unable to proxy: '+req.headers.host+':'+_proxy.listeningPort);
				}
			});
			this.server.on('upgrade', (req, socket, head) => {
				var proxy = _.find(this.proxies, (proxyItem) => {
					var reqUri = req.headers.host.split(':')[0];
					return proxyItem.listen.host == reqUri;
				});
				if (proxy) {
					proxy.proxy.proxyRequest(req, res);
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
			var schema = fs.readFileSync(this.schemaDir+'/configSchema.json');
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
				log.error(_error+': '+_proxyConf.listen.host+':'+_proxy.listeningPort+req.url+' >>> '+_proxyConf.target.host+':'+_proxyConf.target.port+req.url)
			});
			proxy.on('proxyRes', (proxyRes, req, res) => {
				console.log(chalk.blue('[MESSAGE]')+' Proxied: '+_proxyConf.listen.host+':'+_proxy.listeningPort+req.url+' >>> '+_proxyConf.target.host+':'+_proxyConf.target.port+req.url)
			});
			var proxyItem = {
				proxy: proxy,
				listen: proxyConf.listen,
				target: proxyConf.target
			};
			this.proxies.push(proxyItem);
			console.log(chalk.blue('[MESSAGE]')+' Started proxy: '+proxyConf.listen.host+':'+this.listeningPort+' >>> '+proxyConf.target.host+':'+proxyConf.target.port);
			resolve();
		});
	}
}

process.on('SIGINT', function() {
	console.log("\n");
	console.log(chalk.yellow('[WARNING]')+' Stopping proxy server on port: '+_proxy.listeningPort, function() {
		process.exit(0);
	});
});

export default SkProxy;
