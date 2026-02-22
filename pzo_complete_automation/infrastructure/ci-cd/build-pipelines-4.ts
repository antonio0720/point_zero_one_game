// github/workflows/github-action.yml
on: [push]
name: Build
jobs:
build:
runs-on: ubuntu-latest
steps:
- name: Checkout code
uses: actions/checkout@v2
- name: Install dependencies
run: npm install
- name: Build
run: npm run build

// github/workflows/deploy-to-aws.yml
name: Deploy to AWS
on: [push, pull_request]
jobs:
deploy:
runs-on: ubuntu-latest
env:
AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
REGION: us-west-2
steps:
- name: Checkout code
uses: actions/checkout@v2
- name: Login to AWS ECR
id: login
uses: aws-actions/amazon-ecr-login@v1
- name: Build an image
if: github.event_name != 'pull_request'
run: docker build -t my-image . && docker tag my-image:latest ${{ env.AWS_ACCOUNT_ID }}.dkr.ecr.${{ env.REGION }}.amazonaws.com/my-image
- name: Push an image to ECR
if: github.event_name != 'pull_request'
uses: aws-actions/amazon-ecr-push-and-deploy@v4
with:
repository: my-image
tags: latest
region: ${{ env.REGION }}
- name: Deploy to AWS CodePipeline
uses: aws-actions/codepipeline-put-job-form-property@v2
with:
actionName: BuildAndDeploy
inputArtifactNames: codebuildOutput
outputArtifactNames: deployOutput
jobConfiguration: |
{
"version": "1.0",
"phases": [
{
"id": "Source",
"actionTypeId": {
"category": "Source",
"owner": "AWS",
"version": "1",
"provider": "GitHub"
},
"configuration": {
"Owner": "${{ env.GITHUB_OWNER }}",
"Repo": "${{ env.GITHUB_REPO }}",
"BranchName": "${{ github.ref }}"
},
"outputs": [
{
"name": "sourceOutput"
}
]
},
{
"id": "Build",
"actionTypeId": {
"category": "Build",
"owner": "AWS",
"version": "1",
"provider": "CodeBuild"
},
"configuration": {
"ProjectName": "${{ env.CODEBUILD_PROJECT }}",
"InputArtifacts": [
{
"name": "sourceOutput"
}
],
"OutputArtifacts": [
{
"name": "buildOutput"
}
]
},
"inputs": [
{
"name": "buildInput",
"value": "{\"phases\":[{\"name\":\"source\",\"actionConfiguration\":{\"SourceType\":\"GitHub\",\"Owner\":\"${{ env.GITHUB_OWNER }}\",\"Repo\":\"${{ env.GITHUB_REPO }}\",\"BranchName\":\"${{ github.ref }}\",\"OutputArtifact\":\"sourceOutput\"}}]}"
}
],
"outputs": [
{
"name": "buildOutput"
}
]
},
{
"id": "Deploy",
"actionTypeId": {
"category": "Deploy",
"owner": "AWS",
"version": "1",
"provider": "CodePipeline"
},
"configuration": {
"ActionName": "BuildAndDeploy",
"InputArtifacts": [
{
"name": "buildOutput"
}
],
"OutputArtifacts": [
{
"name": "deployOutput"
}
]
},
"inputs": [
{
"name": "deployInput",
"value": "{\"phases\":[{\"name\":\"Build\",\"actionConfiguration\":{\"InputArtifact\":\"buildOutput\"}}]}"
}
]
}
]
}
