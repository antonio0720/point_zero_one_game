```bash
npm install --save-dev lerna snyk
```

Then, create a new script in your `package.json` file:

```json
"scripts": {
"lint": "lerna run lint",
"build": "lerna run build",
"test": "lerna test",
"scan": "snyk test"
}
```

Finally, create a `.npmrc` file in the root of your project with the following content:

```
// npm.pkg.github.com/:_authToken=YOUR_SNYK_TOKEN
```

Replace `YOUR_SNYK_TOKEN` with the Snyk API token generated for your account.

With this setup, you can run dependency scanning on all packages in your monorepo by executing:

```bash
npm run scan
```
