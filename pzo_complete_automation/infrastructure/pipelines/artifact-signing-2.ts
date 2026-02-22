import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as iam from '@aws-cdk/aws-iam';

class ArtifactSigningStack extends cdk.Stack {
constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const repository = new ecr.Repository(this, 'Repo', {
repositoryName: 'my-repo'
});

const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
projectName: 'MyBuildProject',
repository,
buildSpec: codebuild.BuildSpec.fromObject({
version: '0.2',
phases: {
build: {
commands: [
'echo "Building"',
// Your build commands go here
]
}
},
artifacts: {
baseDirectory: '.',
files: ['**/*']
}
})
});

const pipeline = new codepipeline.Pipeline(this, 'MyPipeline', {
pipelineName: 'MyPipeline'
});

pipeline.addStage({
stageName: 'Source',
actions: [
new codepipeline_actions.GitHubSourceAction({
actionName: 'GithubSource',
owner: 'username',
repo: 'repository',
oauthToken: secretsmanager.SecretValue.secretsManager('github-token').toString(),
branch: 'main',
output: new codepipeline.Artifact()
})
]
});

pipeline.addStage({
stageName: 'Build',
actions: [
new codebuildactions.CodeBuildAction({
project,
input: pipeline.stages[0].artifacts[0],
outputs: [new codepipeline.Artifact('BuildOutput')],
actionName: 'Build'
})
]
});

pipeline.addStage({
stageName: 'Sign',
actions: [
new codebuildactions.CodeSigningAction({
artifacts: pipeline.stages[1].artifacts[0],
certificateArn: 'your-code-signing-certificate-arn',
output: new codepipeline.Artifact('SignedOutput'),
actionName: 'Sign'
})
]
});
}
}

const app = new cdk.App();
new ArtifactSigningStack(app, 'MyStack');
