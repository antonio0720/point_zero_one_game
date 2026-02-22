import * as tracer from 'jaeger-client';
import * as opentracing from 'opentracing';
import * as config from 'config';

const jaegerTracerOptions = config.get('jaeger');
const options = {
serviceName: jaegerTracerOptions.serviceName,
sampler: { type: jaegerTracerOptions.samplerType, param: jaegerTracerOptions.samplerParam },
reporter: {
logSpans: true,
logger: opentracing.consoleLogger,
},
};
const tracerInstance = tracer.start(options);

function traceRequest(spanName: string, operationName: string) {
const span = tracerInstance.startSpan(spanName, {
childOf: opentracing.globalTracer().activeSpan,
operationName,
});

// Your code here, inside the callbacks or async functions

span.finish();
}

function traceHttpRequest(req: any, res: any) {
const spanName = 'http_request';
const operationName = `${req.method} ${req.url}`;

const span = tracerInstance.startSpan(spanName, {
childOf: opentracing.globalTracer().activeSpan,
tags: { http.method: req.method, http.url: req.url },
});

req.on('data', (chunk) => span.log({ data: chunk }));
res.on('finish', () => span.log({ statusCode: res.statusCode }));

// Your code here for handling the response, errors, etc.

span.finish();
}
