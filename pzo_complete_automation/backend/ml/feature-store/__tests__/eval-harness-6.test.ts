```bash
npm install --save-dev jest ts-jest @types/jest
```

And then configure Jest in a `jest.config.js` file:

```javascript
module.exports = {
preset: 'ts-jest',
testEnvironment: 'node',
};
```
