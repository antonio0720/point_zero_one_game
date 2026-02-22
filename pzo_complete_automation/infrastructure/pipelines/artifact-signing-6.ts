import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as iam from '@aws-cdk/aws-iam';

class ArtifactSigningStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
pipelineName: 'ArtifactSigningPipeline'
});

const artifactBucket = new codepipeline_actions.S3SourceAction({
actionName: 'Source',
bucket: codepipeline.Token.asStringParam('bucket'),
output: new codepipeline.Artifact(),
artifactType: codepipeline.ArtifactType.S3,
});

pipeline.addStage({
stageName: 'Build',
actions: [artifactBucket],
});

const buildProject = new codebuild.Project(this, 'SigningBuildProject', {
projectName: 'ArtifactSigningBuilder',
buildSpec: codebuild.BuildSpec.fromObject({
version: '0.2',
phases: {
preBuild: {
commands: [
'npm install -g aws-cdk'
]
},
build: {
commands: [
'npm install',
'cdk synth'
],
artifacts: [new codebuild.Artifact('artifacts')]
},
postBuild: {
commands: [
'cp lib/my-artifact-signer /opt/buildroot/'
]
}
},
artifacts: [new codebuild.Artifact('artifacts')],
})
});

pipeline.addStage({
stageName: 'Sign',
actions: [
new codepipeline_actions.CodeBuildAction({
actionName: 'Signer',
project: buildProject,
input: artifactBucket.artifact,
outputs: [new codepipeline.Artifact('signed-artifacts')],
environment: {
buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
additionalPassThroughEnvVariables: {
AWS_REGION: cdk.Stack.of(this).region,
CDK_DEFAULT_ACCOUNT: cdk.Account.CURRENT.accountNumber,
IAM_ROLE: iam.Role.fromRoleArn(this, 'SigningRole', 'role-arn'),
},
},
})
],
});

const secret = new secretsmanager.Secret(this, 'MySecret', {
secretName: 'my-artifact-signer-key'
});

buildProject.addEnvironment('SECRET_NAME', secret.secretArn);
}
}

const app = new cdk.App();
new ArtifactSigningStack(app, 'ArtifactSigning');
