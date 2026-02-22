name: Release Channel 3

on:
push:
branches:
- main

jobs:
build:
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2

- name: Use Node.js v14.x
uses: actions/setup-node@v2
with:
node-version: 14

- name: Install and build project
run: |
npm install
npm run build

deploy:
needs: build
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2
with:
ref: ${{ github.event.ref }}
path: ../

- name: Use Node.js v14.x
uses: actions/setup-node@v2
with:
node-version: 14

- name: Install deployment dependencies
run: npm install --only=production

- name: Deploy to Release Channel 3
env:
API_KEY: ${{ secrets.API_KEY }}
run: |
npm run deploy-rc3
