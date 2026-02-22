1. Install Jest and its presets:

```bash
npm install --save-dev jest @types/jest ts-jest babel-jest @babel/core @babel/preset-env @babel/preset-typescript
```

2. Modify your `package.json` file to include the following:

```json
{
"scripts": {
"test": "jest"
},
"jest": {
"transform": {
"^.+\\.(ts|tsx)?$": "ts-jest"
},
"moduleNameMapper": {
"@/(.*)": "<rootDir>/src/$1",
}
}
}
```

3. Create a `babel.config.js` file:

```javascript
module.exports = {
presets: ['@babel/preset-env', '@babel/preset-typescript']
};
```
