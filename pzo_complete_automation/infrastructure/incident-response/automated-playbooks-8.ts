// github/workflows/security-incident-response.yml
on = [push, pull_request]

name: Security Incident Response

jobs:
scan:
name: Scan Repository for Vulnerabilities
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2
with:
fetch-depth: 0

- name: Install Dependencies
run: |
npm install -g snyk
npm install -g sonarcloud-scanner

- name: Scan with Snyk
env:
SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
run: snyk test --org=myOrg --file-glob="**/*"

- name: Scan with SonarCloud
uses: sonarsource/sonarcloud-scanner-maven@v1
env:
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
SONARCLOUD_LOGIN: ${{ secrets.SONARCLOUD_LOGIN }}
SONARCLOUD_PASSWORD: ${{ secrets.SONARCLOUD_PASSWORD }}
run: mvn sonar:sonar

analyze:
name: Analyze Scan Results and Remediate Findings
needs: scan
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2
with:
fetch-depth: 0
ref: ${{ github.event.run_id }}

- name: Analyze Snyk Scan Results
id: snyk_results
run: |
npm install -g snyk
snyk import --org=myOrg --file-glob="**/*"
snyk test --org=myOrg --output json > snyk.json

- name: Analyze SonarCloud Scan Results
id: sonar_results
run: |
wget https://sonarcloud.io/api/qualitygates/project_analysis_reports/download?branch=refs/heads/${{ github.ref }}&projectKey=${{ secrets.SONAR_PROJECT_KEY }} -O sonar.json

- name: Compare Scan Results and Remediate Findings
uses: actions/compare-sha1@v2
id: compare_results
with:
sha1_file_1: ${{ steps.snyk_results.outputs.sha1 }}
sha1_file_2: ${{ steps.sonar_results.outputs.sha1 }}
run: |
if [ "$(cat snyk.json | jq -r '.vulnerabilities[].id' | grep -Fx -f sonar.json | wc -l)" -gt 0 ]; then
echo "Found common vulnerabilities between Snyk and SonarCloud, remediating..."
# Add a script to remediate the common vulnerabilities found
fi
