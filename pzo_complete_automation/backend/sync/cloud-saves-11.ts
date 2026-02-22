```typescript
import { Component } from '@angular/core';
// ...
import { saveGame } from './path-to-your-code';
```

Then you can call it like this:

```typescript
saveGame(firebase.auth().currentUser?.uid || '', handoffId, gameData);
```
