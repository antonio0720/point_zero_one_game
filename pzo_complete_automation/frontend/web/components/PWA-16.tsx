Here's a simplified example of a React component for a Progressive Web App (PWA) using TypeScript and React Router v6.

```tsx
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Home from './Home';
import About from './About';

function App() {
return (
<Router>
<Switch>
<Route path="/" exact component={Home} />
<Route path="/about" component={About} />
</Switch>
</Router>
);
}

export default App;
```

This code defines an `App` component that utilizes the `BrowserRouter`, `Route`, and `Switch` components from React Router v6 to manage navigation between two routes: the home page (`/`) and about page (`/about`). The `Home` and `About` components are assumed to be located in their respective directories.

To make this a PWA, you would need to implement service workers, manifest.json, and other necessary configurations, but those are beyond the scope of this example. For more information on creating a PWA with React, refer to official documentation: https://reactjs.org/docs/progressive-web-apps.html
