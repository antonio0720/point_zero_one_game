```json
// src/package-A/package.json
{
"scripts": {
"validate": "tsc --noEmit --checkJs"
},
// Other package.json properties...
}
```

You can then run the structure validation for each package by running `npm run validate` in the respective package directories.
