build:
runs-on: ubuntu-latest
steps:
- uses: actions/checkout@v2
with:
fetch-depth: 0

- name: Set up TypeScript
uses: typescript-ecosystem/setup-typescript@v3
with:
tsConfig: ./tsconfig.json

- name: Lint and fix
run: npm run lint:fix

- name: Build
run: npm run build

- name: Test
run: |
npm run test
codecov --token <CODECOV_TOKEN> --file-path ./coverage.json
```
