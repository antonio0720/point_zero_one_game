```typescript
import React from 'react';
import { View, Text } from 'react-native';

const iOS12Screen = () => {
return (
<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
<Text>Welcome to iOS-12 Screen</Text>
</View>
);
};

export default iOS12Screen;
```

In your `App.tsx`, make sure you are importing and using the component like this:

```typescript
import React from 'react';
import { NavigatorIOS } from 'react-native';
import iOS12Screen from './screens/iOS-12';

const App = () => {
return (
<NavigatorIOS
style={{ flex: 1 }}
initialRoute={{
title: 'Welcome',
component: iOS12Screen,
}}
/>
);
};

export default App;
```
