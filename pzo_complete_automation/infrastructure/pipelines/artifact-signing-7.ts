import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codesigner from '@aws-cdk/aws-codestar-connections';
import * as iam from '@aws-cdk/aws-iam';

class ArtifactSigningStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

// CodeSigner Connection
const connection = new codesigner.AwsCodeSignerConnection(this, 'CodeSignerConnection', {
provider: aws_account.Provider,
signingCertificates: [aws_account.certificateArnForAlias('RSA4096')], // Your CodeSigning certificate ARN
});

// BuildProject for building your artifact
const buildProject = new codebuild.Project(this, 'BuildProject', {
// ... (Your build project configuration)
});

// Pipeline
const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
// ... (Your pipeline configuration)
});

// Add source action to the pipeline
pipeline.addStage({
stageName: 'Source',
actions: [
new codepipeline_actions.CodeStarSourceAction({
actionName: 'Source',
owner: 'OWNER', // Your repository owner
repo: 'REPO', // Your repository name
connectionArn: connection.connectionArn,
branch: 'main', // The source code branch
})
],
});

// Add build action to the pipeline
pipeline.addStage({
stageName: 'Build',
actions: [buildProject],
});

// Add signing action to the pipeline
pipeline.addStage({
stageName: 'Sign',
actions: [
new codepipeline_actions.AwsCodeSignAction(this, 'SignAction', {
actionName: 'Sign',
provider: aws_account.Provider,
connectionArn: connection.connectionArn,
signingCertificate: connection.certificateArns[0], // Your CodeSigning certificate ARN
artifacts: pipeline.artifactStreamByIndex(0).stream, // The input artifact from the Build stage
outputArtifact: pipeline.addArtifact('SignedArtifact'),
})
],
});
}
}
