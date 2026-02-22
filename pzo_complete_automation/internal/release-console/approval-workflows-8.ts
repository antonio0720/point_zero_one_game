import { WorkflowExecutionArguments, WorkflowExecutionContext } from 'aws-cdk-lib/awscodebuilder';
import { Duration, ITable } from '@aws-cdk/aws-sdk';
import { CodeBuildProject, CodePipeline, CodePipelineSource, Pipeline, Syntax } from '@aws-cdk/pipelines';
import { Stack, StackProps } from 'constructs';
import { App, Asset, Artifact, ArtifactType, BuildSpec, ManualApprovalAction, CodeStarConnection, GitHubSourceAction } from '@aws-cdk/core';

class ApprovalWorkflows8 extends Stack {
constructor(scope: Construct, id: string, props?: StackProps) {
super(scope, id, props);

const pipeline = new Pipeline(this, 'Pipeline', {
synth: new CodeBuildProject(this, 'Synth', {
buildSpec: BuildSpec.fromObject({
version: '0.2',
phases: {
build: {
commands: [
'npm ci',
'npm run build'
]
},
postBuild: {
commands: [
'cp dist/* artifact/dist'
]
}
},
artifacts: {
baseDirectory: 'dist',
files: ['**'],
type: ArtifactType.FROM_CODEBUILD
}
}),
buildStrategy: new BuildStrategy(),
})
});

const source = GitHubSourceAction.startNew('Source');
source.actionProperties = {
'OAuthToken': CodeStarConnection.basicAuth({
username: 'GITHUB_USERNAME',
password: 'GITHUB_PASSWORD'
}),
'owner': 'OWNER',
'repo': 'REPO'
};

pipeline.addStage({
stageName: 'Source',
actions: [source],
});

const build = pipeline.addStage({
stageName: 'Build',
actions: [pipeline.synth()]
});

const approval1 = new ManualApprovalAction('Approval 1');
const approval2 = new ManualApprovalAction('Approval 2');
const approval3 = new ManualApprovalAction('Approval 3');

const rollback = new CodePipeline(this, 'Rollback', {
pipelineName: 'Rollback' + stack.id,
crossAccountKeys: true,
synth: new CodeBuildProject(this, 'Synth', {
buildSpec: BuildSpec.fromObject({
version: '0.2',
phases: {
preBuild: {
commands: [
'npm ci'
]
},
build: {
commands: [
'npm run rollback'
],
environment: {
RELEASE_ID: '$CODEPIPELINE_CODEBUILD_RESOLVED_SOURCE_VERSION',
}
},
},
artifacts: [{
name: 'MyRollbackArtifact',
type: ArtifactType.S3,
}],
}),
})
});

rollback.addStage({
stageName: 'Source',
actions: [rollback.synth()]
});

const app = new App();
const myAsset = Asset.fromAssetPath(app, 'dist/index.js');

const release = new CodePipeline(this, 'Release', {
pipelineName: 'Release' + stack.id,
crossAccountKeys: true,
synth: new CodeBuildProject(this, 'Synth', {
buildSpec: BuildSpec.fromObject({
version: '0.2',
phases: {
preBuild: {
commands: [
'npm ci'
]
},
build: {
commands: [
'cp ' + myAsset.getBucketKey() + ' dist/index.js',
'npm run release'
],
environment: {
RELEASE_ID: '$CODEPIPELINE_CODEBUILD_RESOLVED_SOURCE_VERSION',
}
},
},
artifacts: [{
name: 'MyReleaseArtifact',
type: ArtifactType.S3,
}],
}),
})
});

release.addStage({
stageName: 'Source',
actions: [release.synth()]
});

release.addStage({
stageName: 'Test',
actions: [approval1]
});

release.addStage({
stageName: 'Deploy',
actions: [approval2, approval3]
});

rollback.addPost(release, new Artifact('MyReleaseArtifact'), {
resultTransform: {
OnSuccess: [approval1],
OnFailure: []
}
});
}
}
