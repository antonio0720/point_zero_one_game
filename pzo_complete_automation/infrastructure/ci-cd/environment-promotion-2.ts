1. Install TypeScript dependencies by running `npm install --save-dev typescript @types/node` in your project directory.
2. Create a new GitHub Actions workflow file (e.g., `.github/workflows/aws-cd.yml`) and include the following content:

```yaml
name: AWS CD Pipeline
on: [push, pull_request]
jobs:
build:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
with:
ref: ${{ github.event.head.ref }}
- name: Set up TypeScript
uses: typescript-action/setup@master
- name: Run AWS CD script
run: node aws-cd.ts
```

3. Customize the `aws-cd.ts` file with your own environment variables, pipeline names, and branch names as needed.
