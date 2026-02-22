import * as React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

interface Props {}

interface State {}

class PWA9 extends React.Component<Props, State> {
render() {
return (
<Router>
<Switch>
<Route path="/" exact component={Home} />
</Switch>
</Router>
);
}
}

const Home = () => (
<div>
<h1>Welcome to PWA-9</h1>
{/* Add your content here */}
</div>
);

export default PWA9;
