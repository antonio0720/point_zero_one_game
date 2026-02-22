```json
{
"compilerOptions": {
"module": "commonjs",
"target": "es6",
"outDir": "./dist/out-tsc",
"rootDir": "./src",
"jsx": "preserve",
"eslint": true,
"forceConsistentCasingInFileNames": true
},
"include": ["src/**/*"],
"exclude": ["node_modules"]
}
```

Finally, in your Jest configuration file (usually `jest.config.js`), specify the TypeScript test file extension:

```javascript
module.exports = {
moduleFileExtensions: ['ts', 'js', 'json'],
transform: {
'^.+\\.(t|j)s$': 'ts-jest'
},
};
```
