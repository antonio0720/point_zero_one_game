name: Dependency Scanning
on: [push, pull_request]
jobs:
build:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
with:
fetch-depth: 0

- name: Set up Node.js
uses: actions/setup-node@v1
with:
node-version: 14

- name: Install Snyk CLI
run: npm install -g snyk

- name: Authenticate Snyk CLI
id: auth
uses: snyk/cli-auth@v2
env:
SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

- name: Run Snyk Test
run: snyk test . --json | jq '.[]| { "testName": .testName, "status": .status, "vulnerabilitiesCount": .vulnerabilities.count }'
