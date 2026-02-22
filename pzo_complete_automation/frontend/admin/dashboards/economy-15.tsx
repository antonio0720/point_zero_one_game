import React from 'react';
import { Grid, Typography } from '@material-ui/core';
import axios from 'axios';

interface GraphData {
label: string;
data: number[];
}

interface Props {}

interface State {
graphData1: GraphData;
graphData2: GraphData;
isLoading: boolean;
}

class EconomyDashboard extends React.Component<Props, State> {
state = {
graphData1: { label: '', data: [] },
graphData2: { label: '', data: [] },
isLoading: true,
};

componentDidMount() {
this.fetchData();
}

async fetchData() {
const response1 = await axios.get('/api/economy-data-1');
const response2 = await axios.get('/api/economy-data-2');

this.setState({
graphData1: { label: 'Economy Data 1', data: response1.data },
graphData2: { label: 'Economy Data 2', data: response2.data },
isLoading: false,
});
}

render() {
const { graphData1, graphData2, isLoading } = this.state;

return (
<Grid container spacing={3}>
<Grid item xs={12} md={6}>
{isLoading ? (
<Typography>Loading...</Typography>
) : (
<div>
<Typography variant="h5">{graphData1.label}</Typography>
{/* Render a chart or graph using the data in 'graphData1.data' */}
</div>
)}
</Grid>
<Grid item xs={12} md={6}>
{isLoading ? (
<Typography>Loading...</Typography>
) : (
<div>
<Typography variant="h5">{graphData2.label}</Typography>
{/* Render a chart or graph using the data in 'graphData2.data' */}
</div>
)}
</Grid>
</Grid>
);
}
}

export default EconomyDashboard;
