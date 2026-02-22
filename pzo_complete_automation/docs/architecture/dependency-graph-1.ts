1. Install Lerna in your project directory:

```sh
npm install lerna --save-dev
```

2. Create a `lerna.json` file for managing packages:

```json
{
"version": "1.0.0",
"packages": [
"packages/*"
]
}
```

3. Install Dagny (Dependency-graph compiler for TypeScript) in your project:

```sh
npm install dagny --save-dev
```

4. Create a `dagny.config.js` file to configure Dagny:

```javascript
module.exports = {
packageJsonPathPattern: 'packages/**/package.json',
};
```

5. Install dependencies for each package inside the packages directory:

```sh
npm run bootstrap
```

6. Add a `tsconfig.json` file to each package, with the following content:

```json
{
"extends": "./node_modules/@dagny-ts/tsconfig"
}
```

7. Create a `src/index.ts` file inside each package, and write your application logic in it.

8. Install the required development dependencies:

```sh
npm install --save-dev typescript @types/jest jest
```

9. Update the `scripts` section of each `package.json`:

```json
{
"name": "your-package-name",
...,
"scripts": {
"build": "tsc",
"test": "jest",
"lint": "eslint .",
"preversion": "npm run build && npm run lint",
"prepublishOnly": "npm run preversion"
},
...
}
```

10. Install the final dependencies:

```sh
npm install
```

Now you have a monorepo with source-of-truth trees using dependency graph 1 (Dagny). To build, test and publish your packages, run commands like `lerna run build`, `lerna test`, and `lerna publish`.
