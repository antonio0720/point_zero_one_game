AWSTemplateFormatVersion: '2010-09-09'
Description: AWS CodePipeline for environment promotion
Resources:
MyPipeline:
Type: AWS::CodePipeline::Pipeline
Properties:
ArtifactStore:
Type: S3
Location: arn:aws:s3:::my-artifacts
EncryptionKey: arn:aws:kms:us-west-2:123456789012:key/my-key
Stages:
- Name: Source
ActionTypeId:
Category: Source
Owner: ThirdParty
Version: '1'
Provider: GitHub
ActionName: GitHub
Configuration:
OAuthToken: ${{ aws_secrets.GITHUB_TOKEN }}
Owner: username
Repo: repository
Branch: master
OAuthEnabled: true
- Name: Build
Type: AWS::CodeBuild::Project
Properties:
ProjectName: my-project
- Name: Test
ActionTypeId:
Category: Test
Owner: ThirdParty
Version: '1'
Provider: SonarCloud
ActionName: SonarCloud
Configuration:
SonarQubeProjectKey: my-project
SonarQubeVersion: latest.LTS
- Name: Deploy
Type: AWS::CodeDeploy::App
Properties:
ApplicationName: my-application
DeploymentGroup:
Description: Production deployment group
AutoScalingGroups:
- name: my-autoscaling-group
LaunchConfiguration:
Name: my-launch-configuration
ECSService:
ClusterName: my-ecs-cluster
ServiceName: my-service
DeploymentConfigName: CodeDeployDefault.OneAtATime
