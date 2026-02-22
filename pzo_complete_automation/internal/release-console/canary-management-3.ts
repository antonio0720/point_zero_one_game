import { CanaryDeployment, DeploymentGroup, Rollout } from 'aws-cdk-lib';
import * as cdk from '@aws-cdk/core';

class CanaryManagementStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const deploymentGroup = new DeploymentGroup(this, 'DeploymentGroup', {
deploymentConfig: new CodeDeployDeploymentConfig({
deploymentStyle: CodeDeployDeploymentStyle.IMMUTABLE,
minimumHealthyPercentage: 50,
maximumBatchSizePercent: 25,
warmUpTimeCoverageThreshold: 250,
}),
});

const app = new cdk.aws_appsync.GraphQLApi(this, 'App', {
// Your API configuration here
});

const canaryDeployment = new CanaryDeployment(this, 'CanaryDeployment', {
deploymentGroup,
deployment: app,
description: 'Canary release',
initialVersion: {
$ref: `App-${app.deploymentStage.stageName}`,
},
newRevision: {
$ref: `App-canary`,
},
maxTrafficRoutePercentage: 50,
});

canaryDeployment.addAlarm({
alarmNamePrefix: 'Canary',
evaluationPeriods: 1,
metric: cdk.Metric.fromAwsAttribute(canaryDeployment.logGroupName, 'ErrorPercentage'),
threshold: 5, // Replace this with your desired error percentage for triggering rollback
});

const rollout = new Rollout(this, 'Rollout', {
deployment: canaryDeployment,
});

rollout.onStatusChange('IN_PROGRESS', {
if: cdk.Condition.stringEquals(${'CanaryDeploymentErrorPercentage'}, '>', cdk.Ref.ref('ErrorThreshold')),
then: new cdk.CfnOutput(this, 'RollbackTriggered', { value: 'true' }),
});
}
}
