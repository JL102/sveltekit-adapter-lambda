'use strict';

import staticFiles from './static.js'

/**
 * @type {(event: import('aws-lambda').APIGatewayEvent, context: import('aws-lambda').Context, callback: import('aws-lambda').APIGatewayProxyCallback) => void}
 */
exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;

  //Only send GET request to S3
  if (request.method !== 'GET') {
    return callback(null, request);
  }

  let uri = request.uri;
  //If our path matches a static file, perfrom an origin re-write to S3;
  if (staticFiles.includes(uri)) {
    return callback(null, performReWrite(uri, request));
  }

  //Remove the leading slash (if any) to normalise the path
  if (uri.slice(-1) === "/") {
    uri = uri.substring(0, uri.length - 1);
  }		

  //Pre-rendered pages could be named `/index.html` or `route/name.html` lets try looking for those as well
  if (staticFiles.includes(uri + '/index.html')) {
    return callback(null, performReWrite(uri + '/index.html', request));
  }
  if (staticFiles.includes(uri + '.html')) {
    return callback(null, performReWrite(uri + '.html', request));
  }
	
	// If the request is for a non-recognized Svelte static file, return a 404.
	// 	Note: The actual error text doesn't get displayed because of a Lambda validation error, but at least the function returns instead of treating it as a cache miss and sending the request to our Svelte function.
	if (uri.startsWith('/_app')) {
		let error = new Error('Not found. The requested resource may be from an outdated version of the app. Please wait a minute or two and refresh.');
		error.statusCode = 404;
		return callback(error);
	}

  callback(null, request);
};

function performReWrite(uri, request) {
  request.uri = uri;
  //Lambda@edge does not support ENV vars, so instead we have to pass in a customHeaders.
  const domainName = request.origin.custom.customHeaders["s3-host"][0].value;
  request.origin.custom.domainName = domainName;
  request.origin.custom.path = "";
  request.headers["host"] = [{ key: "host", value: domainName }];
  return request;
}