// .github/workflows/build-pipelines-6.yml
on = ['push', 'pull_request']
name: Build and Test

jobs:
build:
runs-on: ubuntu-latest

steps:
- name: Checkout code
uses: actions/checkout@v2

- name: Set up Node.js
uses: actions/setup-node@v2
with:
node-version: 14

- name: Install dependencies
run: npm install

- name: Build and test
run: npm run build && npm test

- name: Deploy to production
uses: ad-maddy/github-pages-deploy-action@master
with:
branch: gh-pages
folder: dist
