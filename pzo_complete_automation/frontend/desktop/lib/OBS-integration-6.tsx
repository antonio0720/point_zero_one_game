import * as React from 'react';
import obsClient from 'obs-websocket-js';

interface Props {
// Any necessary props for your component, such as event handlers
}

interface State {
obsConnected: boolean;
// Any other state needed for your component
}

class OBSIntegration extends React.Component<Props, State> {
private client: any;
private sceneName: string;

constructor(props: Props) {
super(props);
this.state = { obsConnected: false };
}

componentDidMount() {
this.connectToOBS();
}

connectToOBS() {
const address = '127.0.0.1:4444'; // OBS listening address
this.client = new obsClient.OBSClient(address);
this.client.connect().then(() => {
this.setState({ obsConnected: true });
});
}

disconnectFromOBS() {
if (this.client) {
this.client.disconnect();
this.setState({ obsConnected: false });
}
}

// Add methods to interact with OBS as needed, such as changing scene or setting properties

render() {
// Render your component UI
}
}

export default OBSIntegration;
