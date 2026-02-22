```bash
npm install -D lerna snyk @snyk/cli-nodejs
```

Then create a `snyk.json` configuration file in the root of your project with the following content:

```json
{
"projectName": "YourProjectName",
"orgId": "YourOrgID",
"apiKey": "YourAPIKey"
}
```

Finally, create a `scripts/snyk-scan.sh` shell script with the following content:

```bash
#!/bin/sh

set -e

npm login --registry=https://api.snyk.io/api/v1
lerna run snyk:test
```

Make sure to replace `YourProjectName`, `YourOrgID`, and `YourAPIKey` with appropriate values.

Now, you can add a new script in your `package.json`:

```json
"scripts": {
"snyk-scan": "bash scripts/snyk-scan.sh"
}
```

To run the scan, execute:

```bash
npm run snyk-scan
```
