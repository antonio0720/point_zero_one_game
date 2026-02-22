push:
branches: [ main ]
pull_request:
branches: [ main ]

jobs:
build:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2

test:
needs: build
runs-on: ubuntu-latest
steps:
- name: Install Dependencies
run: npm install
- name: Run Tests
run: npm test

release:
needs: test
if: ${{ success('test') }}
runs-on: ubuntu-latest
steps:
- name: Prepare Release Assets
run: |
# Prepare assets for release (e.g., build production artifacts)
npm run build

- name: Upload Release Assets
uses: actions/upload-artifact@v2
with:
name: release-assets
env:
ARTIFACT_NAME: 'release'
steps:
- name: Build Artifacts
uses: actions/build-matrix@v1
with:
matrix:
os: [ubuntu-latest, macos-latest, windows-latest]
architecture: [x64, arm64]
steps:
- name: Download Artifacts
uses: actions/download-artifact@v2
with:
name: release-assets
- name: Copy Artifacts to Release Directory
run: |
mkdir -p ${{ env.HOME }}/release
cp ./${{ env.ARTIFACT_NAME}}/* ${{ env.HOME }}/release/

- name: Create GitHub Release
uses: actions/create-release@v1
with:
tag_name: ${{ github.ref }}
release_name: Release Channel 8
draft: false
prerelease: true
generate_release_notes: false
```

This example assumes you have an npm-based project with tests, and it sets up a pipeline that triggers on pushes to the `main` branch and pull requests against it. It builds your project, runs tests, prepares release assets, uploads them to GitHub Actions, and creates a draft prerelease for the specified tag. The assets are built using multiple OS and architecture combinations in the matrix.
