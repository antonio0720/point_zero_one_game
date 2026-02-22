on = ['push']

name: Build Pipeline

jobs:
build:
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2

- name: Use Node.js
uses: actions/setup-node@v2
with:
node-version: '14'

- name: Install Dependencies
run: npm install

- name: Build
run: npm run build

- name: Test
run: npm test

- name: Lint
run: npm run lint

env:
NODE_ENV: production
