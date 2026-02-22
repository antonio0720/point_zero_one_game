import { App } from 'aws-cdk-lib';
import * as chaos from 'chaos-client';
import * as cdk from '@aws-cdk/core';
import * as ecs from '@aws-cdk/aws-ecs';
import * as tasks from '@aws-cdk/aws-ecs-patterns';

class ChaosEngineeringStack extends cdk.Stack {
constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const vpc = new ecs.Vpc(this, 'VPC', { maxAzs: 2 });

const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

const taskDefinition = new ecds.FargateTaskDefinition(this, 'TaskDefinition', {
memoryLimitMiB: 256,
cpu: 256,
networkMode: ecs.NetworkMode.AWSNAT,
containerDefinitions: [{
image: 'alpine:latest',
name: 'ChaosExample',
essential: true,
}],
});

const service = new tasks.FargateService(this, 'Service', {
cluster,
taskDefinition,
desiredCount: 1,
});

// Load Testing using Chaos Library
chaos.AWS.addToStack(this, {
resourceType: 'ecs-cluster',
resourceName: cluster.clusterName,
resources: [service],
actions: [
chaos.AWS.ECS.scaleTaskCount({ max: 100 }), // Scale the task count to 100 for load testing
],
});

// Stress Testing using Chaos Library
chaos.AWS.addToStack(this, {
resourceType: 'ecs-task',
resourceName: service.serviceName,
resources: [service],
actions: [
chaos.AWS.ECS.killTask({ percentage: 50 }), // Kill 50% of the tasks for stress testing
],
});
}
}

const app = new App();
new ChaosEngineeringStack(app, 'ChaosEngineering');
