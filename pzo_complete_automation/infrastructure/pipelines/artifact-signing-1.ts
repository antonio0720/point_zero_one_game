import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as kms from '@aws-cdk/aws-kms';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import { Artifact, CodePipeline, CodePipelineSource, ShellStep } from '@aws-cdk/pipelines';

class ArtifactSigningStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const repository = new ecr.Repository(this, 'Repo', {
repositoryName: 'my-repo'
});

const key = new kms.Key(this, 'SigningKey');

const secret = new secretsmanager.Secret(this, 'Secret', {
secretName: 'my-signing-key-arn',
encryption: secretsmanager.SecretEncryption.KMS_MANAGED,
kmsKey: key
});

const artifact = new Artifact();

const source = new CodePipelineSource({
action: CodePipelineSource.GitHubAction('cdk-deploy'),
output: new cdk.Artifact(),
oauthToken: secret.secretValue.toString() // Replace with actual method to get the Secret value
});

new CodePipeline(this, 'Pipeline', {
pipelineName: 'MyPipeline',
synth: new ShellStep('Synth', {
input: source.artifact,
instructions: ['npm ci', 'npm run build'],
primaryOutputDirectory: 'cdk.out'
}),
stages: [
{
name: 'Source',
actions: [source]
},
{
name: 'Build',
actions: [artifact.addArtifact('BuiltArtifacts')],
order: cdk.PipelineStageOrder.AFTER,
stageProps: {
description: 'Build the artifact'
}
},
{
name: 'Sign',
actions: [
new ShellStep('Sign', {
input: artifact.artifacts[0],
primaryOutputDirectory: 'signed',
instructions: [
`aws ecr get-login-password --region ${cdk.Stack.of(this).region} | docker login --username AWS --password -`,
`docker build -t my-image .`,
`docker tag my-image:latest ${repository.repositoryUri}:latest`,
`aws ecr get-login-password --region ${cdk.Stack.of(this).region} | docker login --username AWS --password -`,
`docker build -t my-image:signed .`,
`docker tag my-image:signed ${repository.repositoryUri}:signing/my-image`,
`aws ecr get-login-password --region ${cdk.Stack.of(this).region} | docker login --username AWS --password -`,
`docker push ${repository.repositoryUri}:latest`,
`docker push ${repository.repositoryUri}:signing/my-image`
]
})
],
order: cdk.PipelineStageOrder.AFTER,
stageProps: {
description: 'Sign the artifact'
}
}
]
});
}
}
