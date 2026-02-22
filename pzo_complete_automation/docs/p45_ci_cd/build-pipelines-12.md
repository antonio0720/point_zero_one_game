```markdown
# CI/CD - Build Pipelines (v12)

This document outlines the version 12 configuration for our Continuous Integration/Continuous Deployment (CI/CD) pipelines using GitHub Actions and Docker.

## Prerequisites

- An active GitHub account with repository access
- Familiarity with YAML syntax
- Basic understanding of Dockerfiles and multi-stage builds
- [Node.js](https://nodejs.org/) and [Python](https://www.python.org/) installed on your system (for local testing)

## Repository Structure

```markdown
my-project/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
│
├── Dockerfile
├── package.json
├── pyproject.toml
└── my-app/
└── ... (your project files)
```

## Dockerfile

The `Dockerfile` is used to create a lightweight, production-ready environment for your application. It defines the base image, installs necessary dependencies, and copies the application files.

### Example Dockerfile

```dockerfile
FROM node:14 as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:14 as runner
WORKDIR /app
COPY --from=builder /app .
RUN npm run build

FROM alpine:latest
WORKDIR /app
COPY --from=runner /app/dist .
EXPOSE 8080
CMD ["node", "main.js"]
```

## GitHub Actions Workflows

GitHub Actions workflows are defined using YAML files in the `.github/workflows/` directory of your repository. They manage building, testing, and deploying your application automatically upon specific events.

### .github/workflows/ci.yml

The CI workflow is responsible for running tests and linting when changes are pushed to the repository.

```yaml
name: CI
on: [push]
jobs:
build-and-test:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
with:
fetch-depth: 0
- name: Setup Node.js
uses: actions/setup-node@v2
with:
node-version: 14
- name: Install and lint
run: |
npm run lint
npm test
```

### .github/workflows/cd.yml

The CD workflow is responsible for creating a Docker image, pushing it to a container registry (e.g., Docker Hub or Google Cloud Build), and deploying it to your infrastructure (e.g., Heroku, AWS ECS).

```yaml
name: CD
on: [push]
jobs:
build-and-deploy:
runs-on: ubuntu-latest
needs: build-and-test
steps:
- name: Use cache
uses: actions/cache@v2
with:
path: ~/.npm
key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
restore-keys: |
${{ runner.os }}-node-

- name: Build and push Docker image
uses: docker/build-push-action@v2
with:
context: .
tag: myusername/my-project:${{ github.ref }}
push: true
```

## Testing Locally

To test your CI/CD pipelines locally, set up a GitHub repository on your local machine and follow these steps:

1. Create a `.github` folder in the root of your project directory.
2. Inside the `.github/workflows/` folder, create `ci.yml` and `cd.yml`.
3. Update the files with the workflow configurations provided above.
4. Add the necessary secrets for authentication (e.g., Docker Hub or GitHub tokens).
5. Run `echo "workflow_dispatch: github.event.client_payload" >> .github/workflows/ci.yml` and `echo "needs: build-and-test" >> .github/workflows/cd.yml`. This will manually trigger the workflows in your local environment.
6. Commit and push the changes to your local repository.
7. Open the Actions tab on GitHub, and you should see the workflows running.
