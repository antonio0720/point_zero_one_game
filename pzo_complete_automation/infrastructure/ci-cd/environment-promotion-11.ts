on = ['push', 'pull_request']

name: Environment Promotion

jobs:
build:
name: Build
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2

- name: Install Dependencies
run: npm install

- name: Build
run: npm run build

deploy-staging-to-production:
needs: build
name: Deploy Staging to Production
runs-on: ubuntu-latest
if: github.event_name != 'pull_request' && (github.ref == 'refs/heads/main') || (github.ref_type == 'tag' && startsWith(github.ref, 'refs/tags/v'))
steps:
- name: Deploy Staging to Production
uses: your-deploy-action@latest
with:
environment: production
