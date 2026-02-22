import React from 'react';
import styled from 'styled-components';
import electron from 'electron';
import OBS from 'obs-websocket';

const Container = styled.div`
/* Add your CSS styles here */
`;

interface Props {
// Add any necessary props here
}

interface State {
obs?: OBS.Client;
connected: boolean;
}

class OBSIntegration extends React.Component<Props, State> {
state = {
connected: false,
};

obs: OBS.Client | null = null;

componentDidMount() {
const { ipcRenderer } = electron;

this.obs = new OBS.Client();

this.obs.connect({ reconnect: true }).then(() => {
ipcRenderer.send('obs-connection-established');
this.setState({ connected: true });
});
}

componentWillUnmount() {
if (this.state.connected && this.obs) {
this.obs.disconnect();
}
}

// Add any necessary methods here for interacting with OBS
}

export default OBSIntegration;
