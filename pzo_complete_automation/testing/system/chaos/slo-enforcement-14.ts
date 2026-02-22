import * as aws from 'aws-sdk';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ssm from '@aws-cdk/aws-ssm';
import * as apigwv2 = require('@aws-cdk/aws-apigatev2');
import { Duration } from '@aws-cdk/core';

class SLOEnforcementStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

// Lambda function for generating load and stress
const loadStressFunction = new lambda.Function(this, 'LoadStressFunction', {
runtime: lambda.Runtime.NODEJS_14_X,
code: lambda.Code.asset('load-stress'),
handler: 'index.handler',
memorySize: 256,
timeout: Duration.seconds(30),
});

// Lambda function for chaos injection
const chaosFunction = new lambda.Function(this, 'ChaosFunction', {
runtime: lambda.Runtime.NODEJS_14_X,
code: lambda.Code.asset('chaos'),
handler: 'index.handler',
memorySize: 256,
timeout: Duration.seconds(30),
});

// System-wide SLO parameter for response time threshold (ms)
const sloParam = new ssm.Parameter(this, 'SLO', {
parameterName: '/slo',
type: ssm.ParameterType.NUMBER,
stringValue: '100', // Default value (100 ms)
description: 'System-wide Service Level Objective (SLO) response time threshold in milliseconds.',
});

// API Gateway for triggering the load and stress tests
const api = new apigwv2.LambdaRestApi(this, 'API', {
restApiName: 'SLOEnforcementAPI',
handler: loadStressFunction,
});

// Integrate Lambda function as an Any API to trigger load and stress tests
const anyApi = api.root.addResource('any');
anyApi.addMethod('POST', new apigwv2.LambdaIntegration(loadStressFunction));

// Lambda Invoke for checking the response time against SLO and injecting chaos if necessary
const checkSLO = new lambda.Function(this, 'CheckSLO', {
runtime: lambda.Runtime.NODEJS_14_X,
code: lambda.Code.asset('check-slo'),
handler: 'index.handler',
memorySize: 256,
timeout: Duration.seconds(3),
});

// Grant the API Gateway execute permissions for the checkSLO Lambda function
checkSloParam.grantReadData(checkSLO);
loadStressFunction.addEnvironment('SLO_PARAM', sloParam.parameterName);

// Trigger checkSLO when the response time exceeds the SLO threshold
const cloudwatch = new aws.CloudWatchEvents({ maxAttempts: 3 });
const rule = cloudwatch.newRule({
ruleName: 'SLOEnforcement',
eventPattern: {
source: ['aws.apigateway'],
detailType: ['AWS API Gateway Execution Details'],
detail: {
apiKey: '', // Your API Key
caller: '', // Your Caller
httpMethod: 'POST',
resourcePath: '/any',
},
},
});

rule.addTarget(new cloudwatch.LambdaFunctionEventTarget(checkSLO));
rule.putTargets();
}
}

const app = new cdk.App();
new SLOEnforcementStack(app, 'MyStack');
