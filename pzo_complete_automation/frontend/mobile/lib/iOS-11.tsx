```tsx
/* App.tsx */
import * as React from 'react';
import { Text, View } from 'react-native';

export default function App() {
return (
<View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
<Text>Welcome to iOS-11 React Native!</Text>
</View>
);
}
```

```tsx
/* index.tsx */
import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

```json
/* app.json */
{
"name": "iOS-11",
"version": "0.0.1",
"platform": "ios",
"main": "./index.js"
}
```

Make sure you have React Native CLI version 0.60 or higher and TypeScript set up in your project. To initialize a new project, run:

```bash
npx react-native init iOS-11 --template typescript
cd iOS-11
npm install
npm install react-native-typescript-transformer --save
```

After that, replace the content of `babel.config.js` and `metro.config.js` with:

```js
/* babel.config.js */
module.exports = {
presets: ['babel-preset-react-native', 'react-native-typescript-transformer'],
};
```

```js
/* metro.config.js */
const { getDefaultConfig } = require('metro-config');

module.exports = (async () => {
const defaultConfig = await getDefaultConfig();
return {
transformer: {
getTransformOptions: async () => ({
transform: {
experimentalImportSupport: false,
inlineRequires: true,
},
}),
},
...defaultConfig,
};
})();
```
