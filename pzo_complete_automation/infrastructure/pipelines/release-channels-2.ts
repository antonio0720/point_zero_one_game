push:
branches:
- main
jobs:
build_and_release:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
- name: Setup Node.js
uses: actions/setup-node@v2
with:
node-version: 14
- name: Install dependencies
run: npm install
- name: Build
run: npm run build
- name: Publish to npm (Main Channel)
uses: actions/publish-package@v2
with:
registry: ${{ secrets.NPM_REGISTRY }}
username: ${{ secrets.NPM_USERNAME }}
password: ${{ secrets.NPM_PASSWORD }}
- name: Publish to GitHub Packages (Beta Channel)
uses: actions/upload-artifact@v2
with:
name: artifact
path: dist
env:
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
- name: Publish to GitHub Packages (Beta Channel)
run: |
npm login --registry=https://npm.pkg.github.com
npm config set @myorg:registry https://npm.pkg.github.com/myorg
npm publish --access public
```

This example demonstrates the following:

1. Triggers on `push` events to the `main` branch.
2. Sets up Node.js environment and installs dependencies.
3. Builds the project using a custom `build` script in your package.json file.
4. Publishes the built artifacts to npm as part of the main release channel.
5. Packages the dist folder as an artifact for later use.
6. Uploads the artifact (the built files) to GitHub packages as a beta channel.
7. Logs into GitHub packages with appropriate scopes and publishes the package there as well.
