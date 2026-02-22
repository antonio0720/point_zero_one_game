import * as React from 'react';
import { useEffect } from 'react';
import obs from 'obs-websocket';

interface Props {}

interface State {
obsClient?: obs.OBS;
}

class OBSIntegration extends React.Component<Props, State> {
state: State = {};

componentDidMount() {
const client = new obs.OBS();
client.connect({ address: '127.0.0.1', port: 4444 })
.then(() => {
this.setState({ obsClient: client });
})
.catch((err) => console.error(err));
}

componentWillUnmount() {
if (this.state.obsClient) {
this.state.obsClient.disconnect();
}
}

// Add your OBS interaction functions here, like sending scene transitions, changing sources etc.
}

export default OBSIntegration;
