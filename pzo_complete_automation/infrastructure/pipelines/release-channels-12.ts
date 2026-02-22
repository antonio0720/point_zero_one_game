// github.workflow.yml
name: Release Channels 12
on: [push, pull_request]
jobs:
build:
name: Build
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
- name: Set up Node.js
uses: actions/setup-node@v2
with:
node-version: 14
- name: Install Dependencies and Build
run: |
npm install
npm run build
- name: Publish to npm
uses: npm/node-publisher@v2.5.0
with:
npm-auth-token: ${{ secrets.NPM_AUTH_TOKEN }}
registry: https://registry.npmjs.org/
- name: Release to GitHub Packages
uses: actions/upload-artifact@v2
with:
name: build
path: dist
release:
name: Release
needs: build
if: needs.build.succeeded()
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
with:
repository: your-username/your-repository
ref: ${{ github.ref }}  # or tags/<tag-name> for tagged releases
- name: Login to GitHub Packages
uses: actions/github-script@v4
with:
github-token: ${{ secrets.GITHUB_TOKEN }}
script: |
const core = require('@actions/core');
const { context } = require('@actions/github');
const packageName = 'your-package';
const packageVersion = context.ref;  # or get the tag from the GitHub API if using tags
const auth = new Buffer.from(`${core.getInput('npm_token')}:x-oauth-basic`).toString('base64');
return `npm login --registry=https://npm.pkg.github.com --scope=@your-username --always-auth=true --user=$ {JSON.stringify({ username: 'your-username', password: auth })}`;
- name: Publish to GitHub Packages
uses: actions/upload-artifact@v2
with:
name: build
path: dist
registry-url: https://npm.pkg.github.com/your-username/_packages/npm
semver:
name: Semantic Versioning
runs-on: ubuntu-latest
steps:
- name: Set up Node.js
uses: actions/setup-node@v2
with:
node-version: 14
- name: Checkout and Build
run: |
git checkout master && git pull origin master
npm install --only=dev
npm run lint
npm run build
- name: Generate CHANGELOG.md
id: changelog
run: npm run changelog
- name: Update Package.json
if: github.event_name != 'pull_request'
run: |
npm version patch --no-git-tag-version
git add package.json CHANGELOG.md
git commit -m "chore(release): bump version and update changelog"
- name: Push to origin
if: github.event_name != 'pull_request'
uses: ad-m/github-push-action@master
with:
token: ${{ secrets.GITHUB_TOKEN }}
