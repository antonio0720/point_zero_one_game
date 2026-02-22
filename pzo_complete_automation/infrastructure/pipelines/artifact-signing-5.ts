import * as cdk from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ssm from '@aws-cdk/aws-ssm';

class ArtifactSigningStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

// Key management service (KMS) key for signing artifacts
const kmsKey = new kms.Key(this, 'ArtifactSigningKey', {
description: 'KMS key for signing artifacts'
});

// ECR repository to store the signed artifacts
const ecrRepository = new ecr.Repository(this, 'SignedArtifactRepo', {
repositoryName: 'signed-artifacts'
});

// Secret containing the KMS key ARN for use in CodeBuild projects
const kmsKeyArnSecret = new secretsmanager.Secret(this, 'KmsKeyArnSecret', {
secretName: '/kms/key-arn/artifact-signing'
});
kmsKeyArnSecret.stringVersionThatExists().then((version) => {
version.attachPolicy(new cdk.iam.PolicyStatement({
actions: ['SecretsManager:GetSecretValue'],
principals: [new cdk.AccountPrincipal()]
}));
});

// CodeBuild project to sign artifacts
const buildProject = new codepipeline_actions.CodeBuildAction({
project: new codebuild.PipelineProject(this, 'ArtifactSigningProject', {
buildSpec: codebuild.BuildSpec.fromObject({
version: '0.2',
phases: {
build: {
actions: [{
name: 'aws-codebuild-gradle',
actionInfo: {
inputs: {
env: {
ARTIFACT_REPO_REGION: cdk.Stack.of(this).region,
KMS_KEY_ARN: kmsKeyArnSecret.secretValue.toString()
},
type: 'S3'
},
version: '1'
}
}]
}
},
artifacts: {
base: {
type: 'S3'
},
buildBy: {
type: 'CodeBuild'
}
}
}),
environment: {
buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
computeType: codebuild.ComputeType.SMALL
},
timeout: cdk.Duration.minutes(10)
}),
inputs: [{
name: 'sourceOutput'
}]
});

// CodePipeline pipeline for the artifact signing workflow
const pipeline = new codepipeline.Pipeline(this, 'ArtifactSigningPipeline', {
pipelineName: 'artifact-signing-pipeline'
});

// Stage for source code (replace with your source repository)
const sourceStage = pipeline.addStage({
stageName: 'Source',
actions: [{
action: new codepipeline_actions.CodeStarConnectionsAction({
connectionArn: cdk.Arn.of(codeconnections.CONSOLE),
outputArtifacts: ['sourceOutput'],
owner: 'YOUR_ACCOUNT_ID', // Replace with your account ID
repoName: 'YOUR_REPO_NAME', // Replace with your repository name
branchName: 'main' // Replace with the branch you want to use (or use refs/heads/* for all branches)
})],
});

// Stage for signing artifacts
const signStage = pipeline.addStage({
stageName: 'Sign',
actions: [buildProject]
});

// Output the signed artifact to an ECR repository
new codepipeline_actions.EcsDeployAction({
actionName: 'DeployToECR',
output: buildProject.action.artifacts[0],
destination: ecrRepository,
minage: cdk.Version.fromVersionNumber(1),
taskDefinitionArnOptions: {
ecsTaskDefinition: ecrRepository.getDeployTaskDefinition(),
region: this.region
}
}).addToStage(signStage);
}
}
