name: Artifact Signing - 12

on: [push, pull_request]

jobs:
build-and-sign:
runs-on: ubuntu-latest

steps:
- uses: actions/checkout@v2

- name: Set up Docker Buildx
uses: docker/setup-buildx-action@v1

- name: Login to Docker Hub
id: login
uses: docker/login-action@v1
with:
registry: docker.io
username: ${{ secrets.DOCKER_USERNAME }}
password: ${{ secrets.DOCKER_PASSWORD }}

- name: Build and push the image
id: build
uses: docker/build-push-action@v2
with:
context: .
push: true
tags: docker.io/${{ secrets.DOCKER_USERNAME }}/my-image:${{ github.run_id }}

- name: Sign the image
id: sign
uses: docker/container-action@v1
with:
container: alpine:latest
args: sh -c 'apk add --no-cache gnupg && gpg --output my-image.asc --detach-sign --arm64 docker inspect -f {{ .Config.ImgSize }} docker.io/${{ secrets.DOCKER_USERNAME }}/my-image:${{ github.run_id }}'
env:
GPG_KEY: ${{ secrets.GPG_KEY }}

- name: Upload the signature to Docker Hub
id: upload
uses: docker/upload-image-action@v2
with:
tags: docker.io/${{ secrets.DOCKER_USERNAME }}/my-image:${{ github.run_id }}
push: true
file: my-image.asc
