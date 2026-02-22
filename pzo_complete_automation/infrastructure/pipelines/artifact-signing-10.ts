import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as iam from '@aws-cdk/aws-iam';
import * as cloudwatch_actions from '@aws-cdk/aws-cloudwatch-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import * as artifact from '@aws-cdk/aws-codeartifact';
import * as ssm from '@aws-cdk/aws-ssm';

class ArtifactSigningStack extends cdk.Stack {
constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
super(scope, id, props);

// ECR repository for storing artifacts
const ecrRepo = new ecr.Repository(this, 'EcrRepo', { repositoryName: 'my-repo' });

// CodeBuild project for building and signing the Docker image
const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
projectName: 'ArtifactSigningBuild',
buildSpec: codebuild.BuildSpec.fromObject({
version: '0.2',
phases: {
pre_build: {
commands: [
// Add your build commands here, e.g., to build the Docker image
]
},
build: {
commands: [
// Sign the artifact with AWS CodeSign
'codebuild-cli sign --region us-east-1',
`aws ssm put-parameter --name ArtifactSigningKey --type SecureString --value $CODEBUILD_SIGNING_KEY`,
// Push the signed image to ECR
`docker build -t my-image .`,
`docker tag my-image:latest ${ecrRepo.repositoryUri.toString()}:latest`,
`docker push ${ecrRepo.repositoryUri.toString()}:latest`,
]
}
},
artifacts: codebuild.Artifacts.fromObject({
baseDirectory: '.',
files: ['**/*']
}),
}),
});

// Grant necessary permissions to the CodeBuild service role
buildProject.addToRolePolicy(new iam.PolicyStatement({
actions: [
'ecr:GetAuthorizationToken',
'ecr:BatchCheckLayerAvailability',
'ecr:BatchGetImage',
'ecr:GetDownloadUrlForLayer',
'ecr:BatchGetRepositoryScanningConfiguration',
'ssm:GetParameters',
],
resources: [
ecrRepo.repositoryArn,
`${ssm.Manager.manager.arnPrefix}/parameters/*`
]
}));

// Secrets Manager to store the AWS CodeSign signing key
const signingKey = new secretsmanager.Secret(this, 'SigningKey', { secretName: 'ArtifactSigningKey' });

// AWS CodeArtifact repository for storing the signed artifacts
const codeartifactRepo = new artifact.Repository(this, 'CodeArtifactRepo', {
repositoryName: 'SignedArtifacts'
});

// AWS CodePipeline source action to trigger pipeline from the CodeCommit repository
const sourceAction = new codepipeline.SourceAction({
actionName: 'Source',
owner: 'aws',
repo: 'my-repo',
branch: 'master',
oauthToken: ssm.StringParameter.valueFromJson('MyCodecommitOAuthToken').toString(),
});

// CodePipeline pipeline with the build project as the action
const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
pipelineName: 'ArtifactSigningPipeline'
});

pipeline.addStage({
stageName: 'Source',
actions: [sourceAction]
});

pipeline.addStage({
stageName: 'BuildAndSign',
actions: [buildProject],
dependencies: ['Source']
});

// Output the CodeArtifact repository URL
new cdk.CfnOutput(this, 'SignedArtifactsRepoUrl', {
value: codeartifactRepo.repositoryUri.toString()
});
}
}
