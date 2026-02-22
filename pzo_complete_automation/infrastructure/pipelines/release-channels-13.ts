push:
branches:
- main
pull_request:
branches:
- main

jobs:
build:
runs-on: ubuntu-latest
steps:
- name: Checkout code
uses: actions/checkout@v2
- name: Install dependencies
run: npm ci
- name: Build artifacts
run: npm run build
if: github.event_name != 'pull_request'

deploy-dev:
needs: build
runs-on: ubuntu-latest
if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.pull_request.merged)
steps:
- name: Use Node.js
uses: actions/setup-node@v2
with:
node-version: 14
- name: Install dependencies and deploy to dev release channel
run: |
npm install --only=dev
npm run lerna publish --tag dev --registry=https://registry.npmjs.org/ --access public

deploy-prod:
needs: build
runs-on: ubuntu-lts
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
steps:
- name: Use Node.js
uses: actions/setup-node@v2
with:
node-version: 14
- name: Install dependencies and deploy to prod release channel
run: |
npm install --only=prod
npm run lerna publish --tag latest --registry=https://registry.npmjs.org/
```

This configuration sets up two pipelines: `dev` and `prod`. The `build` job is common for both, and it runs when there's a push to the main branch or when a pull request against the main branch is merged. The `dev` pipeline deploys to the dev release channel on each push and merging a pull request, while the `prod` pipeline deploys to the production release channel only on pushes directly to the main branch.
