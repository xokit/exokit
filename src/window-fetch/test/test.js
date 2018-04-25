
// test tools
import chai from 'chai';
import chaiPromised from 'chai-as-promised';
import chaiIterator from 'chai-iterator';
import chaiString from 'chai-string';
import then from 'promise';
import resumer from 'resumer';
import FormData from 'form-data';
import URLSearchParams_Polyfill from 'url-search-params';
import { URL } from 'whatwg-url';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const { parse: parseURL, URLSearchParams } = require('url');

let convert;
try { convert = require('encoding').convert; } catch(e) { }

chai.use(chaiPromised);
chai.use(chaiIterator);
chai.use(chaiString);
const expect = chai.expect;

import TestServer from './server';

// test subjects
import fetch, {
	FetchError,
	Headers,
	Request,
	Response
} from '../src/';
import FetchErrorOrig from '../src/fetch-error.js';
import HeadersOrig from '../src/headers.js';
import RequestOrig from '../src/request.js';
import ResponseOrig from '../src/response.js';
import Body from '../src/body.js';
import Blob from '../src/blob.js';

const supportToString = ({
	[Symbol.toStringTag]: 'z'
}).toString() === '[object z]';

const local = new TestServer();
const base = `http://${local.hostname}:${local.port}/`;
let url, opts;

before(done => {
	local.start(done);
});

after(done => {
	local.stop(done);
});

describe('node-fetch', () => {
	it('should return a promise', function() {
		url = `${base}hello`;
		const p = fetch(url);
		expect(p).to.be.an.instanceof(fetch.Promise);
		expect(p).to.have.property('then');
	});

	it('should allow custom promise', function() {
		url = `${base}hello`;
		const old = fetch.Promise;
		fetch.Promise = then;
		expect(fetch(url)).to.be.an.instanceof(then);
		expect(fetch(url)).to.not.be.an.instanceof(old);
		fetch.Promise = old;
	});

	it('should throw error when no promise implementation are found', function() {
		url = `${base}hello`;
		const old = fetch.Promise;
		fetch.Promise = undefined;
		expect(() => {
			fetch(url)
		}).to.throw(Error);
		fetch.Promise = old;
	});

	it('should expose Headers, Response and Request constructors', function() {
		expect(FetchError).to.equal(FetchErrorOrig);
		expect(Headers).to.equal(HeadersOrig);
		expect(Response).to.equal(ResponseOrig);
		expect(Request).to.equal(RequestOrig);
	});

	(supportToString ? it : it.skip)('should support proper toString output for Headers, Response and Request objects', function() {
		expect(new Headers().toString()).to.equal('[object Headers]');
		expect(new Response().toString()).to.equal('[object Response]');
		expect(new Request(base).toString()).to.equal('[object Request]');
	});

	it('should reject with error if url is protocol relative', function() {
		url = '//example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, 'Only absolute URLs are supported');
	});

	it('should reject with error if url is relative path', function() {
		url = '/some/path';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, 'Only absolute URLs are supported');
	});

	it('should reject with error if protocol is unsupported', function() {
		url = 'ftp://example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, 'Only HTTP(S) protocols are supported');
	});

	it('should reject with error on network failure', function() {
		url = 'http://localhost:50000/';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.include({ type: 'system', code: 'ECONNREFUSED', errno: 'ECONNREFUSED' });
	});

	it('should resolve into response', function() {
		url = `${base}hello`;
		return fetch(url).then(res => {
			expect(res).to.be.an.instanceof(Response);
			expect(res.headers).to.be.an.instanceof(Headers);
			expect(res.body).to.be.an.instanceof(stream.Transform);
			expect(res.bodyUsed).to.be.false;

			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
		});
	});

	it('should accept plain text response', function() {
		url = `${base}plain`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('text');
			});
		});
	});

	it('should accept html response (like plain text)', function() {
		url = `${base}html`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/html');
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('<html></html>');
			});
		});
	});

	it('should accept json response', function() {
		url = `${base}json`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('application/json');
			return res.json().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.an('object');
				expect(result).to.deep.equal({ name: 'value' });
			});
		});
	});

	it('should send request with custom headers', function() {
		url = `${base}inspect`;
		opts = {
			headers: { 'x-custom-header': 'abc' }
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should accept headers instance', function() {
		url = `${base}inspect`;
		opts = {
			headers: new Headers({ 'x-custom-header': 'abc' })
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should accept custom host header', function() {
		url = `${base}inspect`;
		opts = {
			headers: {
				host: 'example.com'
			}
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers['host']).to.equal('example.com');
		});
	});

	it('should follow redirect code 301', function() {
		url = `${base}redirect/301`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			expect(res.ok).to.be.true;
		});
	});

	it('should follow redirect code 302', function() {
		url = `${base}redirect/302`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 303', function() {
		url = `${base}redirect/303`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 307', function() {
		url = `${base}redirect/307`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 308', function() {
		url = `${base}redirect/308`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect chain', function() {
		url = `${base}redirect/chain`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow POST request redirect code 301 with GET', function() {
		url = `${base}redirect/301`;
		opts = {
			method: 'POST'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('GET');
				expect(result.body).to.equal('');
			});
		});
	});

	it('should follow POST request redirect code 302 with GET', function() {
		url = `${base}redirect/302`;
		opts = {
			method: 'POST'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('GET');
				expect(result.body).to.equal('');
			});
		});
	});

	it('should follow redirect code 303 with GET', function() {
		url = `${base}redirect/303`;
		opts = {
			method: 'PUT'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('GET');
				expect(result.body).to.equal('');
			});
		});
	});

	it('should obey maximum redirect, reject case', function() {
		url = `${base}redirect/chain`;
		opts = {
			follow: 1
		}
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-redirect');
	});

	it('should obey redirect chain, resolve case', function() {
		url = `${base}redirect/chain`;
		opts = {
			follow: 2
		}
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should allow not following redirect', function() {
		url = `${base}redirect/301`;
		opts = {
			follow: 0
		}
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-redirect');
	});

	it('should support redirect mode, manual flag', function() {
		url = `${base}redirect/301`;
		opts = {
			redirect: 'manual'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(301);
			expect(res.headers.get('location')).to.equal(`${base}inspect`);
		});
	});

	it('should support redirect mode, error flag', function() {
		url = `${base}redirect/301`;
		opts = {
			redirect: 'error'
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'no-redirect');
	});

	it('should support redirect mode, manual flag when there is no redirect', function() {
		url = `${base}hello`;
		opts = {
			redirect: 'manual'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(200);
			expect(res.headers.get('location')).to.be.null;
		});
	});

	it('should follow redirect code 301 and keep existing headers', function() {
		url = `${base}redirect/301`;
		opts = {
			headers: new Headers({ 'x-custom-header': 'abc' })
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			return res.json();
		}).then(res => {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should reject broken redirect', function() {
		url = `${base}error/redirect`;
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'invalid-redirect');
	});

	it('should not reject broken redirect under manual redirect', function() {
		url = `${base}error/redirect`;
		opts = {
			redirect: 'manual'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(301);
			expect(res.headers.get('location')).to.be.null;
		});
	});

	it('should handle client-error response', function() {
		url = `${base}error/400`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.status).to.equal(400);
			expect(res.statusText).to.equal('Bad Request');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('client error');
			});
		});
	});

	it('should handle server-error response', function() {
		url = `${base}error/500`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.status).to.equal(500);
			expect(res.statusText).to.equal('Internal Server Error');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('server error');
			});
		});
	});

	it('should handle network-error response', function() {
		url = `${base}error/reset`;
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'ECONNRESET');
	});

	it('should handle DNS-error response', function() {
		url = 'http://domain.invalid';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'ENOTFOUND');
	});

	it('should reject invalid json response', function() {
		url = `${base}error/json`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('application/json');
			return expect(res.json()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.include({ type: 'invalid-json' });
		});
	});

	it('should handle no content response', function() {
		url = `${base}no-content`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.ok).to.be.true;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should reject when trying to parse no content response as json', function() {
		url = `${base}no-content`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.ok).to.be.true;
			return expect(res.json()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.include({ type: 'invalid-json' });
		});
	});

	it('should handle no content response with gzip encoding', function() {
		url = `${base}no-content/gzip`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			expect(res.ok).to.be.true;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should handle not modified response', function() {
		url = `${base}not-modified`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(304);
			expect(res.statusText).to.equal('Not Modified');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should handle not modified response with gzip encoding', function() {
		url = `${base}not-modified/gzip`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(304);
			expect(res.statusText).to.equal('Not Modified');
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should decompress gzip response', function() {
		url = `${base}gzip`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress slightly invalid gzip response', function() {
		url = `${base}gzip-truncated`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress deflate response', function() {
		url = `${base}deflate`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress deflate raw response from old apache server', function() {
		url = `${base}deflate-raw`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should skip decompression if unsupported', function() {
		url = `${base}sdch`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('fake sdch string');
			});
		});
	});

	it('should reject if response compression is invalid', function() {
		url = `${base}invalid-content-encoding`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('code', 'Z_DATA_ERROR');
		});
	});

	it('should allow disabling auto decompression', function() {
		url = `${base}gzip`;
		opts = {
			compress: false
		};
		return fetch(url, opts).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.not.equal('hello world');
			});
		});
	});

	it('should allow custom timeout', function() {
		this.timeout(500);
		url = `${base}timeout`;
		opts = {
			timeout: 100
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'request-timeout');
	});

	it('should allow custom timeout on response body', function() {
		this.timeout(500);
		url = `${base}slow`;
		opts = {
			timeout: 100
		};
		return fetch(url, opts).then(res => {
			expect(res.ok).to.be.true;
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('type', 'body-timeout');
		});
	});

	it('should clear internal timeout on fetch response', function (done) {
		this.timeout(2000);
		spawn('node', ['-e', `require('./')('${base}hello', { timeout: 10000 })`])
			.on('exit', () => {
				done();
			});
	});

	it('should clear internal timeout on fetch redirect', function (done) {
		this.timeout(2000);
		spawn('node', ['-e', `require('./')('${base}redirect/301', { timeout: 10000 })`])
			.on('exit', () => {
				done();
			});
	});

	it('should clear internal timeout on fetch error', function (done) {
		this.timeout(2000);
		spawn('node', ['-e', `require('./')('${base}error/reset', { timeout: 10000 })`])
			.on('exit', () => {
				done();
			});
	});

	it('should set default User-Agent', function () {
		url = `${base}inspect`;
		fetch(url).then(res => res.json()).then(res => {
			expect(res.headers['user-agent']).to.startWith('node-fetch/');
		});
	});

	it('should allow setting User-Agent', function () {
		url = `${base}inspect`;
		opts = {
			headers: {
				'user-agent': 'faked'
			}
		};
		fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.headers['user-agent']).to.equal('faked');
		});
	});

	it('should set default Accept header', function () {
		url = `${base}inspect`;
		fetch(url).then(res => res.json()).then(res => {
			expect(res.headers.accept).to.equal('*/*');
		});
	});

	it('should allow setting Accept header', function () {
		url = `${base}inspect`;
		opts = {
			headers: {
				'accept': 'application/json'
			}
		};
		fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.headers.accept).to.equal('application/json');
		});
	});

	it('should allow POST request', function() {
		url = `${base}inspect`;
		opts = {
			method: 'POST'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('0');
		});
	});

	it('should allow POST request with string body', function() {
		url = `${base}inspect`;
		opts = {
			method: 'POST'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.equal('text/plain;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with buffer body', function() {
		url = `${base}inspect`;
		opts = {
			method: 'POST'
			, body: Buffer.from('a=1', 'utf-8')
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with blob body without type', function() {
		url = `${base}inspect`;
		opts = {
			method: 'POST'
			, body: new Blob(['a=1'])
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with blob body with type', function() {
		url = `${base}inspect`;
		opts = {
			method: 'POST',
			body: new Blob(['a=1'], {
				type: 'text/plain;charset=UTF-8'
			})
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.equal('text/plain;charset=utf-8');
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with readable stream as body', function() {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());

		url = `${base}inspect`;
		opts = {
			method: 'POST'
			, body
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.equal('chunked');
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.be.undefined;
		});
	});

	it('should allow POST request with form-data as body', function() {
		const form = new FormData();
		form.append('a','1');

		url = `${base}multipart`;
		opts = {
			method: 'POST'
			, body: form
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.startWith('multipart/form-data;boundary=');
			expect(res.headers['content-length']).to.be.a('string');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow POST request with form-data using stream as body', function() {
		const form = new FormData();
		form.append('my_field', fs.createReadStream(path.join(__dirname, 'dummy.txt')));

		url = `${base}multipart`;
		opts = {
			method: 'POST'
			, body: form
		};

		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.startWith('multipart/form-data;boundary=');
			expect(res.headers['content-length']).to.be.undefined;
			expect(res.body).to.contain('my_field=');
		});
	});

	it('should allow POST request with form-data as body and custom headers', function() {
		const form = new FormData();
		form.append('a','1');

		const headers = form.getHeaders();
		headers['b'] = '2';

		url = `${base}multipart`;
		opts = {
			method: 'POST'
			, body: form
			, headers
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.startWith('multipart/form-data; boundary=');
			expect(res.headers['content-length']).to.be.a('string');
			expect(res.headers.b).to.equal('2');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow POST request with object body', function() {
		url = `${base}inspect`;
		// note that fetch simply calls tostring on an object
		opts = {
			method: 'POST'
			, body: { a:1 }
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('[object Object]');
			expect(res.headers['content-type']).to.equal('text/plain;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('15');
		});
	});

	const itUSP = typeof URLSearchParams === 'function' ? it : it.skip;
	itUSP('should allow POST request with URLSearchParams as body', function() {
		const params = new URLSearchParams();
		params.append('a','1');

		url = `${base}inspect`;
		opts = {
			method: 'POST',
			body: params,
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
			expect(res.body).to.equal('a=1');
		});
	});

	itUSP('should still recognize URLSearchParams when extended', function() {
		class CustomSearchParams extends URLSearchParams {}
		const params = new CustomSearchParams();
		params.append('a','1');

		url = `${base}inspect`;
		opts = {
			method: 'POST',
			body: params,
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
			expect(res.body).to.equal('a=1');
		});
	});

	/* for 100% code coverage, checks for duck-typing-only detection
	 * where both constructor.name and brand tests fail */
	it('should still recognize URLSearchParams when extended from polyfill', function() {
		class CustomPolyfilledSearchParams extends URLSearchParams_Polyfill {}
		const params = new CustomPolyfilledSearchParams();
		params.append('a','1');

		url = `${base}inspect`;
		opts = {
			method: 'POST',
			body: params,
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should overwrite Content-Length if possible', function() {
		url = `${base}inspect`;
		// note that fetch simply calls tostring on an object
		opts = {
			method: 'POST',
			headers: {
				'Content-Length': '1000'
			},
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.equal('text/plain;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow PUT request', function() {
		url = `${base}inspect`;
		opts = {
			method: 'PUT'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('PUT');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow DELETE request', function() {
		url = `${base}inspect`;
		opts = {
			method: 'DELETE'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('DELETE');
		});
	});

	it('should allow DELETE request with string body', function() {
		url = `${base}inspect`;
		opts = {
			method: 'DELETE'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('DELETE');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow PATCH request', function() {
		url = `${base}inspect`;
		opts = {
			method: 'PATCH'
			, body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('PATCH');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow HEAD request', function() {
		url = `${base}hello`;
		opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.body).to.be.an.instanceof(stream.Transform);
			return res.text();
		}).then(text => {
			expect(text).to.equal('');
		});
	});

	it('should allow HEAD request with content-encoding header', function() {
		url = `${base}error/404`;
		opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(404);
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			return res.text();
		}).then(text => {
			expect(text).to.equal('');
		});
	});

	it('should allow OPTIONS request', function() {
		url = `${base}options`;
		opts = {
			method: 'OPTIONS'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
			expect(res.headers.get('allow')).to.equal('GET, HEAD, OPTIONS');
			expect(res.body).to.be.an.instanceof(stream.Transform);
		});
	});

	it('should reject decoding body twice', function() {
		url = `${base}plain`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				return expect(res.text()).to.eventually.be.rejectedWith(Error);
			});
		});
	});

	it('should support maximum response size, multiple chunk', function() {
		url = `${base}size/chunk`;
		opts = {
			size: 5
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('type', 'max-size');
		});
	});

	it('should support maximum response size, single chunk', function() {
		url = `${base}size/long`;
		opts = {
			size: 5
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('type', 'max-size');
		});
	});

	it('should allow piping response body as stream', function() {
		url = `${base}hello`;
		return fetch(url).then(res => {
			expect(res.body).to.be.an.instanceof(stream.Transform);
			return streamToPromise(res.body, chunk => {
				if (chunk === null) {
					return;
				}
				expect(chunk.toString()).to.equal('world');
			});
		});
	});

	it('should allow cloning a response, and use both as stream', function() {
		url = `${base}hello`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			expect(res.body).to.be.an.instanceof(stream.Transform);
			expect(r1.body).to.be.an.instanceof(stream.Transform);
			const dataHandler = chunk => {
				if (chunk === null) {
					return;
				}
				expect(chunk.toString()).to.equal('world');
			};

			return Promise.all([
				streamToPromise(res.body, dataHandler),
				streamToPromise(r1.body, dataHandler)
			]);
		});
	});

	it('should allow cloning a json response and log it as text response', function() {
		url = `${base}json`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			return Promise.all([res.json(), r1.text()]).then(results => {
				expect(results[0]).to.deep.equal({name: 'value'});
				expect(results[1]).to.equal('{"name":"value"}');
			});
		});
	});

	it('should allow cloning a json response, and then log it as text response', function() {
		url = `${base}json`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			return res.json().then(result => {
				expect(result).to.deep.equal({name: 'value'});
				return r1.text().then(result => {
					expect(result).to.equal('{"name":"value"}');
				});
			});
		});
	});

	it('should allow cloning a json response, first log as text response, then return json object', function() {
		url = `${base}json`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			return r1.text().then(result => {
				expect(result).to.equal('{"name":"value"}');
				return res.json().then(result => {
					expect(result).to.deep.equal({name: 'value'});
				});
			});
		});
	});

	it('should not allow cloning a response after its been used', function() {
		url = `${base}hello`;
		return fetch(url).then(res =>
			res.text().then(result => {
				expect(() => {
					res.clone();
				}).to.throw(Error);
			})
		);
	});

	it('should allow get all responses of a header', function() {
		url = `${base}cookie`;
		return fetch(url).then(res => {
			const expected = 'a=1, b=1';
			expect(res.headers.get('set-cookie')).to.equal(expected);
			expect(res.headers.get('Set-Cookie')).to.equal(expected);
		});
	});

	it('should return all headers using raw()', function() {
		url = `${base}cookie`;
		return fetch(url).then(res => {
			const expected = [
				'a=1',
				'b=1'
			];

			expect(res.headers.raw()['set-cookie']).to.deep.equal(expected);
		});
	});

	it('should allow iterating through all headers with forEach', function() {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['b', '3'],
			['a', '1']
		]);
		expect(headers).to.have.property('forEach');

		const result = [];
		headers.forEach((val, key) => {
			result.push([key, val]);
		});

		expect(result).to.deep.equal([
			["a", "1"]
			, ["b", "2, 3"]
			, ["c", "4"]
		]);
	});

	it('should allow iterating through all headers with for-of loop', function() {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');
		expect(headers).to.be.iterable;

		const result = [];
		for (let pair of headers) {
			result.push(pair);
		}
		expect(result).to.deep.equal([
			['a', '1'],
			['b', '2, 3'],
			['c', '4']
		]);
	});

	it('should allow iterating through all headers with entries()', function() {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');

		expect(headers.entries()).to.be.iterable
			.and.to.deep.iterate.over([
				['a', '1'],
				['b', '2, 3'],
				['c', '4']
			]);
	});

	it('should allow iterating through all headers with keys()', function() {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');

		expect(headers.keys()).to.be.iterable
			.and.to.iterate.over(['a', 'b', 'c']);
	});

	it('should allow iterating through all headers with values()', function() {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');

		expect(headers.values()).to.be.iterable
			.and.to.iterate.over(['1', '2, 3', '4']);
	});

	it('should allow deleting header', function() {
		url = `${base}cookie`;
		return fetch(url).then(res => {
			res.headers.delete('set-cookie');
			expect(res.headers.get('set-cookie')).to.be.null;
		});
	});

	it('should reject illegal header', function() {
		const headers = new Headers();
		expect(() => new Headers({ 'He y': 'ok' })).to.throw(TypeError);
		expect(() => new Headers({ 'Hé-y': 'ok' })).to.throw(TypeError);
		expect(() => new Headers({ 'He-y': 'ăk' })).to.throw(TypeError);
		expect(() => headers.append('Hé-y', 'ok')) .to.throw(TypeError);
		expect(() => headers.delete('Hé-y'))       .to.throw(TypeError);
		expect(() => headers.get('Hé-y'))          .to.throw(TypeError);
		expect(() => headers.has('Hé-y'))          .to.throw(TypeError);
		expect(() => headers.set('Hé-y', 'ok'))    .to.throw(TypeError);

		// 'o k' is valid value but invalid name
		new Headers({ 'He-y': 'o k' });
	});

	it('should send request with connection keep-alive if agent is provided', function() {
		url = `${base}inspect`;
		opts = {
			agent: new http.Agent({
				keepAlive: true
			})
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers['connection']).to.equal('keep-alive');
		});
	});

	it('should ignore unsupported attributes while reading headers', function() {
		const FakeHeader = function () {};
		// prototypes are currently ignored
		// This might change in the future: #181
		FakeHeader.prototype.z = 'fake';

		const res = new FakeHeader;
		res.a = 'string';
		res.b = ['1','2'];
		res.c = '';
		res.d = [];
		res.e = 1;
		res.f = [1, 2];
		res.g = { a:1 };
		res.h = undefined;
		res.i = null;
		res.j = NaN;
		res.k = true;
		res.l = false;
		res.m = Buffer.from('test');

		const h1 = new Headers(res);
		h1.set('n', [1, 2]);
		h1.append('n', ['3', 4])

		const h1Raw = h1.raw();

		expect(h1Raw['a']).to.include('string');
		expect(h1Raw['b']).to.include('1,2');
		expect(h1Raw['c']).to.include('');
		expect(h1Raw['d']).to.include('');
		expect(h1Raw['e']).to.include('1');
		expect(h1Raw['f']).to.include('1,2');
		expect(h1Raw['g']).to.include('[object Object]');
		expect(h1Raw['h']).to.include('undefined');
		expect(h1Raw['i']).to.include('null');
		expect(h1Raw['j']).to.include('NaN');
		expect(h1Raw['k']).to.include('true');
		expect(h1Raw['l']).to.include('false');
		expect(h1Raw['m']).to.include('test');
		expect(h1Raw['n']).to.include('1,2');
		expect(h1Raw['n']).to.include('3,4');

		expect(h1Raw['z']).to.be.undefined;
	});

	it('should wrap headers', function() {
		const h1 = new Headers({
			a: '1'
		});
		const h1Raw = h1.raw();

		const h2 = new Headers(h1);
		h2.set('b', '1');
		const h2Raw = h2.raw();

		const h3 = new Headers(h2);
		h3.append('a', '2');
		const h3Raw = h3.raw();

		expect(h1Raw['a']).to.include('1');
		expect(h1Raw['a']).to.not.include('2');

		expect(h2Raw['a']).to.include('1');
		expect(h2Raw['a']).to.not.include('2');
		expect(h2Raw['b']).to.include('1');

		expect(h3Raw['a']).to.include('1');
		expect(h3Raw['a']).to.include('2');
		expect(h3Raw['b']).to.include('1');
	});

	it('should accept headers as an iterable of tuples', function() {
		let headers;

		headers = new Headers([
			['a', '1'],
			['b', '2'],
			['a', '3']
		]);
		expect(headers.get('a')).to.equal('1, 3');
		expect(headers.get('b')).to.equal('2');

		headers = new Headers([
			new Set(['a', '1']),
			['b', '2'],
			new Map([['a', null], ['3', null]]).keys()
		]);
		expect(headers.get('a')).to.equal('1, 3');
		expect(headers.get('b')).to.equal('2');

		headers = new Headers(new Map([
			['a', '1'],
			['b', '2']
		]));
		expect(headers.get('a')).to.equal('1');
		expect(headers.get('b')).to.equal('2');
	});

	it('should throw a TypeError if non-tuple exists in a headers initializer', function() {
		expect(() => new Headers([ ['b', '2', 'huh?'] ])).to.throw(TypeError);
		expect(() => new Headers([ 'b2' ])).to.throw(TypeError);
		expect(() => new Headers('b2')).to.throw(TypeError);
		expect(() => new Headers({ [Symbol.iterator]: 42 })).to.throw(TypeError);
	});

	it('should support fetch with Request instance', function() {
		url = `${base}hello`;
		const req = new Request(url);
		return fetch(req).then(res => {
			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
		});
	});

	it('should support fetch with Node.js URL object', function() {
		url = `${base}hello`;
		const urlObj = parseURL(url);
		const req = new Request(urlObj);
		return fetch(req).then(res => {
			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
		});
	});

	it('should support fetch with WHATWG URL object', function() {
		url = `${base}hello`;
		const urlObj = new URL(url);
		const req = new Request(urlObj);
		return fetch(req).then(res => {
			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
		});
	});

	it('should support blob round-trip', function() {
		url = `${base}hello`;

		let length, type;

		return fetch(url).then(res => res.blob()).then(blob => {
			url = `${base}inspect`;
			length = blob.size;
			type = blob.type;
			return fetch(url, {
				method: 'POST',
				body: blob
			});
		}).then(res => res.json()).then(({body, headers}) => {
			expect(body).to.equal('world');
			expect(headers['content-type']).to.equal(type);
			expect(headers['content-length']).to.equal(String(length));
		});
	});

	it('should support wrapping Request instance', function() {
		url = `${base}hello`;

		const form = new FormData();
		form.append('a', '1');

		const r1 = new Request(url, {
			method: 'POST'
			, follow: 1
			, body: form
		});
		const r2 = new Request(r1, {
			follow: 2
		});

		expect(r2.url).to.equal(url);
		expect(r2.method).to.equal('POST');
		// note that we didn't clone the body
		expect(r2.body).to.equal(form);
		expect(r1.follow).to.equal(1);
		expect(r2.follow).to.equal(2);
		expect(r1.counter).to.equal(0);
		expect(r2.counter).to.equal(0);
	});

	it('should support overwrite Request instance', function() {
		url = `${base}inspect`;
		const req = new Request(url, {
			method: 'POST'
			, headers: {
				a: '1'
			}
		});
		return fetch(req, {
			method: 'GET'
			, headers: {
				a: '2'
			}
		}).then(res => {
			return res.json();
		}).then(body => {
			expect(body.method).to.equal('GET');
			expect(body.headers.a).to.equal('2');
		});
	});

	it('should throw error with GET/HEAD requests with body', function() {
		expect(() => new Request('.', { body: '' }))
			.to.throw(TypeError);
		expect(() => new Request('.', { body: 'a' }))
			.to.throw(TypeError);
		expect(() => new Request('.', { body: '', method: 'HEAD' }))
			.to.throw(TypeError);
		expect(() => new Request('.', { body: 'a', method: 'HEAD' }))
			.to.throw(TypeError);
	});

	it('should support empty options in Response constructor', function() {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body);
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support parsing headers in Response constructor', function() {
		const res = new Response(null, {
			headers: {
				a: '1'
			}
		});
		expect(res.headers.get('a')).to.equal('1');
	});

	it('should support text() method in Response constructor', function() {
		const res = new Response('a=1');
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support json() method in Response constructor', function() {
		const res = new Response('{"a":1}');
		return res.json().then(result => {
			expect(result.a).to.equal(1);
		});
	});

	it('should support buffer() method in Response constructor', function() {
		const res = new Response('a=1');
		return res.buffer().then(result => {
			expect(result.toString()).to.equal('a=1');
		});
	});

	it('should support blob() method in Response constructor', function() {
		const res = new Response('a=1', {
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain'
			}
		});
		return res.blob().then(function(result) {
			expect(result).to.be.an.instanceOf(Blob);
			expect(result.isClosed).to.be.false;
			expect(result.size).to.equal(3);
			expect(result.type).to.equal('text/plain');

			result.close();
			expect(result.isClosed).to.be.true;
			expect(result.size).to.equal(0);
			expect(result.type).to.equal('text/plain');
		});
	});

	it('should support clone() method in Response constructor', function() {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body, {
			headers: {
				a: '1'
			}
			, url: base
			, status: 346
			, statusText: 'production'
		});
		const cl = res.clone();
		expect(cl.headers.get('a')).to.equal('1');
		expect(cl.url).to.equal(base);
		expect(cl.status).to.equal(346);
		expect(cl.statusText).to.equal('production');
		expect(cl.ok).to.be.false;
		// clone body shouldn't be the same body
		expect(cl.body).to.not.equal(body);
		return cl.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support stream as body in Response constructor', function() {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body);
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support string as body in Response constructor', function() {
		const res = new Response('a=1');
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support buffer as body in Response constructor', function() {
		const res = new Response(Buffer.from('a=1'));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support blob as body in Response constructor', function() {
		const res = new Response(new Blob(['a=1']));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should default to null as body', function() {
		const res = new Response();
		expect(res.body).to.equal(null);
		const req = new Request('.');
		expect(req.body).to.equal(null);

		const cb = result => expect(result).to.equal('');
		return Promise.all([
			res.text().then(cb),
			req.text().then(cb)
		]);
	});

	it('should default to 200 as status code', function() {
		const res = new Response(null);
		expect(res.status).to.equal(200);
	});

	it('should support parsing headers in Request constructor', function() {
		url = base;
		const req = new Request(url, {
			headers: {
				a: '1'
			}
		});
		expect(req.url).to.equal(url);
		expect(req.headers.get('a')).to.equal('1');
	});

	it('should support arrayBuffer() method in Request constructor', function() {
		url = base;
		var req = new Request(url, {
			method: 'POST',
			body: 'a=1'
		});
		expect(req.url).to.equal(url);
		return req.arrayBuffer().then(function(result) {
			expect(result).to.be.an.instanceOf(ArrayBuffer);
			const str = String.fromCharCode.apply(null, new Uint8Array(result));
			expect(str).to.equal('a=1');
		});
	});

	it('should support text() method in Request constructor', function() {
		url = base;
		const req = new Request(url, {
			method: 'POST',
			body: 'a=1'
		});
		expect(req.url).to.equal(url);
		return req.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support json() method in Request constructor', function() {
		url = base;
		const req = new Request(url, {
			method: 'POST',
			body: '{"a":1}'
		});
		expect(req.url).to.equal(url);
		return req.json().then(result => {
			expect(result.a).to.equal(1);
		});
	});

	it('should support buffer() method in Request constructor', function() {
		url = base;
		const req = new Request(url, {
			method: 'POST',
			body: 'a=1'
		});
		expect(req.url).to.equal(url);
		return req.buffer().then(result => {
			expect(result.toString()).to.equal('a=1');
		});
	});

	it('should support blob() method in Request constructor', function() {
		url = base;
		var req = new Request(url, {
			method: 'POST',
			body: Buffer.from('a=1')
		});
		expect(req.url).to.equal(url);
		return req.blob().then(function(result) {
			expect(result).to.be.an.instanceOf(Blob);
			expect(result.isClosed).to.be.false;
			expect(result.size).to.equal(3);
			expect(result.type).to.equal('');

			result.close();
			expect(result.isClosed).to.be.true;
			expect(result.size).to.equal(0);
			expect(result.type).to.equal('');
		});
	});

	it('should support arbitrary url in Request constructor', function() {
		url = 'anything';
		const req = new Request(url);
		expect(req.url).to.equal('anything');
	});

	it('should support clone() method in Request constructor', function() {
		url = base;
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const agent = new http.Agent();
		const req = new Request(url, {
			body
			, method: 'POST'
			, redirect: 'manual'
			, headers: {
				b: '2'
			}
			, follow: 3
			, compress: false
			, agent
		});
		const cl = req.clone();
		expect(cl.url).to.equal(url);
		expect(cl.method).to.equal('POST');
		expect(cl.redirect).to.equal('manual');
		expect(cl.headers.get('b')).to.equal('2');
		expect(cl.follow).to.equal(3);
		expect(cl.compress).to.equal(false);
		expect(cl.method).to.equal('POST');
		expect(cl.counter).to.equal(0);
		expect(cl.agent).to.equal(agent);
		// clone body shouldn't be the same body
		expect(cl.body).to.not.equal(body);
		return Promise.all([cl.text(), req.text()]).then(results => {
			expect(results[0]).to.equal('a=1');
			expect(results[1]).to.equal('a=1');
		});
	});

	it('should support arrayBuffer(), blob(), text(), json() and buffer() method in Body constructor', function() {
		const body = new Body('a=1');
		expect(body).to.have.property('arrayBuffer');
		expect(body).to.have.property('blob');
		expect(body).to.have.property('text');
		expect(body).to.have.property('json');
		expect(body).to.have.property('buffer');
	});

	it('should create custom FetchError', function funcName() {
		const systemError = new Error('system');
		systemError.code = 'ESOMEERROR';

		const err = new FetchError('test message', 'test-error', systemError);
		expect(err).to.be.an.instanceof(Error);
		expect(err).to.be.an.instanceof(FetchError);
		expect(err.name).to.equal('FetchError');
		expect(err.message).to.equal('test message');
		expect(err.type).to.equal('test-error');
		expect(err.code).to.equal('ESOMEERROR');
		expect(err.errno).to.equal('ESOMEERROR');
		expect(err.stack).to.include('funcName')
			.and.to.startWith(`${err.name}: ${err.message}`);
	});

	it('should support https request', function() {
		this.timeout(5000);
		url = 'https://github.com/';
		opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.ok).to.be.true;
		});
	});

});

function streamToPromise(stream, dataHandler) {
	return new Promise((resolve, reject) => {
		stream.on('data', (...args) => {
			Promise.resolve()
				.then(() => dataHandler(...args))
				.catch(reject);
		});
		stream.on('end', resolve);
		stream.on('error', reject);
	});
}

describe('external encoding', () => {
	const hasEncoding = typeof convert === 'function';

	describe('with optional `encoding`', function() {
		before(function() {
			if(!hasEncoding) this.skip();
		});

		it('should only use UTF-8 decoding with text()', function() {
			url = `${base}encoding/euc-jp`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.text().then(result => {
					expect(result).to.equal('<?xml version="1.0" encoding="EUC-JP"?><title>\ufffd\ufffd\ufffd\u0738\ufffd</title>');
				});
			});
		});

		it('should support encoding decode, xml dtd detect', function() {
			url = `${base}encoding/euc-jp`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.textConverted().then(result => {
					expect(result).to.equal('<?xml version="1.0" encoding="EUC-JP"?><title>日本語</title>');
				});
			});
		});

		it('should support encoding decode, content-type detect', function() {
			url = `${base}encoding/shift-jis`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.textConverted().then(result => {
					expect(result).to.equal('<div>日本語</div>');
				});
			});
		});

		it('should support encoding decode, html5 detect', function() {
			url = `${base}encoding/gbk`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.textConverted().then(result => {
					expect(result).to.equal('<meta charset="gbk"><div>中文</div>');
				});
			});
		});

		it('should support encoding decode, html4 detect', function() {
			url = `${base}encoding/gb2312`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.textConverted().then(result => {
					expect(result).to.equal('<meta http-equiv="Content-Type" content="text/html; charset=gb2312"><div>中文</div>');
				});
			});
		});

		it('should default to utf8 encoding', function() {
			url = `${base}encoding/utf8`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				expect(res.headers.get('content-type')).to.be.null;
				return res.textConverted().then(result => {
					expect(result).to.equal('中文');
				});
			});
		});

		it('should support uncommon content-type order, charset in front', function() {
			url = `${base}encoding/order1`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.textConverted().then(result => {
					expect(result).to.equal('中文');
				});
			});
		});

		it('should support uncommon content-type order, end with qs', function() {
			url = `${base}encoding/order2`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				return res.textConverted().then(result => {
					expect(result).to.equal('中文');
				});
			});
		});

		it('should support chunked encoding, html4 detect', function() {
			url = `${base}encoding/chunked`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				const padding = 'a'.repeat(10);
				return res.textConverted().then(result => {
					expect(result).to.equal(`${padding}<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS" /><div>日本語</div>`);
				});
			});
		});

		it('should only do encoding detection up to 1024 bytes', function() {
			url = `${base}encoding/invalid`;
			return fetch(url).then(res => {
				expect(res.status).to.equal(200);
				const padding = 'a'.repeat(1200);
				return res.textConverted().then(result => {
					expect(result).to.not.equal(`${padding}中文`);
				});
			});
		});
	});

	describe('without optional `encoding`', function() {
		before(function() {
			if (hasEncoding) this.skip()
		});

		it('should throw a FetchError if res.textConverted() is called without `encoding` in require cache', () => {
			url = `${base}hello`;
			return fetch(url).then((res) => {
				return expect(res.textConverted()).to.eventually.be.rejected
					.and.have.property('message').which.includes('encoding')
			});
		});
	});
});
