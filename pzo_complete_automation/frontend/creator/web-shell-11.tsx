```typescript
import * as React from 'react';
import styles from './WebShell11.module.css';

interface Props {
}

const WebShell11: React.FC<Props> = () => {
return (
<div className={styles.webShellContainer}>
<div className={styles.terminal}>
<div className={styles.terminalContent}>
// Your shell content goes here
</div>
</div>
</div>
);
};

export default WebShell11;
```

And the CSS for this component:

```css
.webShellContainer {
display: flex;
justify-content: center;
align-items: center;
height: 100vh;
background-color: #f5f5f5;
}

.terminal {
width: 80%;
max-width: 900px;
height: 60vh;
border: 1px solid #ccc;
box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.2);
overflow: auto;
}

.terminalContent {
padding: 1rem;
font-family: 'Courier New', monospace;
font-size: 14px;
}
```
