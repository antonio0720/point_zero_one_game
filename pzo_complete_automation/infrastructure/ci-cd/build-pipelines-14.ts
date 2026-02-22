name: Build and Deploy
on:
push:
branches:
- main

jobs:
build:
name: Build
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2

- name: Set up Node.js
uses: actions/setup-node@v2
with:
node-version: 14.x

- name: Install dependencies
run: npm install

- name: Build
run: npm run build

deploy:
name: Deploy
needs: build
runs-on: ubuntu-latest

steps:
- uses: actions/setup-ssh-key@v1
with:
ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
ssh-agent-env: INPUT_SSH_AUTH_SOCK

- name: Deploy to server
run: scp -r ./dist user@server:/path/to/deploy
