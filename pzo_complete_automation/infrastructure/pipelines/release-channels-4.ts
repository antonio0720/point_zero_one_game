// github-actions.yml
on = ['push']

jobs:
build-and-deploy:
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2

- name: Set up Node.js
uses: actions/setup-node@v2
with:
node-version: 14

- name: Install dependencies
run: npm install

- name: Build
run: npm run build

- name: Deploy to staging
uses: JamesIves/github-actions-ssh@v3
with:
host: your_staging_server_host
username: your_username
private-key: ${{ secrets.SSH_PRIVATE_KEY }}
port: 22
dir: ./dist
command: |
mkdir -p ~/your_app
cp -R ./dist/* ~/your_app

- name: Deploy to production
if: github.ref == 'refs/heads/main'
uses: JamesIves/github-actions-ssh@v3
with:
host: your_production_server_host
username: your_username
private-key: ${{ secrets.SSH_PRIVATE_KEY }}
port: 22
dir: ./dist
command: |
mkdir -p ~/your_app
cp -R ./dist/* ~/your_app
