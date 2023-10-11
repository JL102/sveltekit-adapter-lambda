import { Server } from '../index.js';
import { manifest } from '../manifest.js';
import { splitCookiesString } from 'set-cookie-parser';

export async function handler(event, context) {
  const app = new Server(manifest);
  const { rawPath, headers, rawQueryString, body, requestContext, isBase64Encoded, cookies } = event;

  const encoding = isBase64Encoded ? 'base64' : headers['content-encoding'] || 'utf-8';
  const domainName = headers['x-forwarded-host']
  const rawBody = typeof body === 'string' ? Buffer.from(body, encoding) : body;

  if (cookies) {
    headers['cookie'] = cookies.join('; ')
  }

  let rawURL = `https://${domainName}${rawPath}${rawQueryString ? `?${rawQueryString}` : ''}`

  /*
   {
      callbackWaitsForEmptyEventLoop: [Getter/Setter],
      succeed: [Function (anonymous)],
      fail: [Function (anonymous)],
      done: [Function (anonymous)],
      functionVersion: '77',
      functionName: 'ScoutradiozVoyagerStack-SvelteFunction',
      memoryLimitInMB: '256',
      logGroupName: '/aws/lambda/ScoutradiozVoyagerStack-SvelteFunction',
      logStreamName: '2023/10/10/[77]324897a51a3c479580dc75c0e052094e',
      clientContext: undefined,
      identity: undefined,
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:243452333432:function:ScoutradiozVoyagerStack-SvelteFunction:PROD',
      awsRequestId: '0fcde827-1bf9-4a80-9912-ff195fcb4c5b',
      getRemainingTimeInMillis: [Function: getRemainingTimeInMillis]
    }
   */
	const alias = context.invokedFunctionArn.replace(/.*:/g,'');
	
	process.env.ALIAS = alias;
	//process.env.TIER is overridden here during every request.
	process.env.TIER = alias.toLowerCase();
	
  await app.init({
		env: process.env
	});

  //Render the app
  const rendered = await app.respond(new Request(rawURL, {
    method: requestContext.http.method,
    headers: new Headers(headers),
    body: rawBody,
  }),{
    platform: { context }
  });

  //Parse the response into lambda proxy response
  if (rendered) {
    const resp = {
      headers: {},
      cookies: [],
      body: await rendered.text(),
      statusCode: rendered.status
    }

    for (let k of rendered.headers.keys()) {
      let header = rendered.headers.get(k)

      if (k == 'set-cookie') {
        resp.cookies = resp.cookies.concat(splitCookiesString(header));
      } else {
        //For multivalue headers, join them
        if (header instanceof Array) {
          header = header.join(',')
        }
        resp.headers[k] = header
      }
    }
    return resp
  }
  return {
    statusCode: 404,
    body: 'Not found.'
  }
}
