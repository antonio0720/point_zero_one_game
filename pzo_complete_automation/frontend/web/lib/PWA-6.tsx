```typescript
import * as React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import serviceWorkerRegistration from './serviceWorkerRegistration';

interface AppProps {}

class App extends React.Component<AppProps> {
componentDidMount() {
serviceWorkerRegistration.register();
}

render() {
return (
<Router>
<Switch>
<Route path="/" exact component={Home} />
<Route path="/about" component={About} />
{/* Add more routes as needed */}
</Switch>
</Router>
);
}
}

const Home = () => <div>Welcome to my PWA!</div>;
const About = () => <div>Learn about my PWA here.</div>;

export default App;
```

This code sets up a simple PWA with React and React Router. It mounts a single component `App`, which contains the main routing for your application. It also includes service worker registration to support offline functionality. You can further customize this basic structure by adding more components, styling, and features as needed.

Note that you'll need to create the `serviceWorkerRegistration` file separately:

```typescript
import { Registration } from 'workbox-core';

export const serviceWorkerRegistration = async () => {
navigator.serviceWorker.register('./service-worker.js', { scope: '/' })
.then((registration: Registration) => {
console.log('Service worker registered:', registration);
})
.catch((error: Error) => {
console.error('Error during service worker registration:', error);
});
};
```

This service worker registration code registers a service worker with the specified JavaScript file (`service-worker.js`) in your project. Make sure to adjust the path accordingly.
