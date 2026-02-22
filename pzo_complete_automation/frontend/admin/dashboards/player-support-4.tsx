import React from 'react';
import { PlayerSupport4Data } from './player-support-4-data';
import { Table, Card, Spinner } from '@patternfly/react-core';

interface PlayerSupport4Props {}

const PlayerSupport4: React.FC<PlayerSupport4Props> = () => {
const [data, setData] = React.useState(PlayerSupport4Data);
const [loading, setLoading] = React.useState(true);

React.useEffect(() => {
// Fetch data and update state when component mounts
// ...
setLoading(false);
}, []);

if (loading) {
return <Spinner />;
}

return (
<Card>
<Table
cells={[
{ title: 'Player', field: 'player' },
{ title: 'Issue', field: 'issue' },
{ title: 'Status', field: 'status' },
{ title: 'Resolution', field: 'resolution' },
]}
rows={data.map((row) => ({
cells: [row.player, row.issue, row.status, row.resolution],
}))}
/>
</Card>
);
};

export default PlayerSupport4;
