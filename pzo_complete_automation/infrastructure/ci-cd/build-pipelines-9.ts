build:
runs-on: ubuntu-latest
container:
image: 'build-environment'
steps:
- name: Checkout code
uses: actions/checkout@v2

- name: Install dependencies
run: npm install

- name: Build
run: npm run build

- name: Test
run: npm test

build-and-push-image:
needs: build
runs-on: ubuntu-latest
container:
image: 'build-environment'
steps:
- name: Checkout code
uses: actions/checkout@v2

- name: Build Docker image
run: docker build -t my-image .

- name: Push Docker image
uses: docker/build-push-action@master
with:
context: .
push: true
username: ${{ secrets.DOCKERHUB_USERNAME }}
password: ${{ secrets.DOCKERHUB_PASSWORD }}

// Dockerfile
FROM node:latest as builder
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
RUN npm run build

FROM node:latest
WORKDIR /app
COPY --from=builder /app/dist .
CMD ["your-entrypoint"]
```
