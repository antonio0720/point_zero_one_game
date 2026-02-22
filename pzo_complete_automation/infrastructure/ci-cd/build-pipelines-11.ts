import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudformation from '@aws-cdk/aws-cloudformation';

class BuildPipelinesStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const sourceBucket = new s3.Bucket(this, 'SourceArtifactBucket', {
bucketName: `${cdk.Stack.of(this).stackName}-source`,
});

const deploymentPipeline = new codepipeline.Pipeline(this, 'DeploymentPipeline', {
pipelineName: `CDK-Deployment-Pipeline-${cdk.Stack.of(this).stackName}`,
});

deploymentPipeline.addArtifact(new codepipeline.Artifact());
const source = deploymentPipeline.sources.github({
owner: 'your-username',
repo: 'your-repo',
oauthToken: cdk.SecretValue.secretsManager('github-oauth'),
connectionArn: cdk. Arn.of(new codepipeline_actions.GithubConnection(this, 'GithubConnection', {
owner: 'your-username',
repo: 'your-repo',
})),
});

const synthAction = new codepipeline_actions.CloudAssemblyTemplate(this, 'Synth', {
sourceArtifact: deploymentPipeline.artifacts[0],
templatePath: codepipeline_actions.Asset.fromAssetDirectory(`./cdk/my-app-stack`),
});

deploymentPipeline.addStage({
stageName: 'Source',
actions: [source],
});

deploymentPipeline.addStage({
stageName: 'Build',
actions: [synthAction],
});

const app = new cloudformation.Stack(this, 'MyAppStack', {
stackName: `${cdk.Stack.of(this).stackName}-app`,
template: synthAction.outputArtifact,
});
}
}

const myAppCDKStack = new cdk.App();
new BuildPipelinesStack(myAppCDKStack, 'MyAppCDKStack');
myAppCDKStack.synth();
