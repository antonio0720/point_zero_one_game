// github/workflows/environment-promotion.yml
on: [push, pull_request]

jobs:
build:
runs-on: ubuntu-latest
steps:
- name: Checkout repository
uses: actions/checkout@v2

- name: Install dependencies
run: npm install

- name: Build the application
run: npm run build

- name: Test the application
run: npm test

- name: Deploy to staging
uses: actions/deploy@v1
with:
repository: your-org/your-repo
ref: ${{ github.event.ref }}
branch: staging
environment: staging
token: ${{ secrets.DEPLOY_TOKEN }}

- name: Promote to production if pull request is closed
if: github.event_name == 'pull_request' && github.event.action == 'closed'
uses: actions/github-script@v3
with:
script: |
const { context } = github;
const { REPO_OWNER, REPO, DEPLOY_TOKEN } = context.repo;
const github = require('@actions/github');
async function run() {
const octokit = new github.GitHub(DEPLOY_TOKEN);
await octokit.rest.repos.createRelease({
owner: REPO_OWNER,
repo: REPO,
tag: context.event.pull_request.head.sha,
name: 'Promote to production',
});
}
run();
