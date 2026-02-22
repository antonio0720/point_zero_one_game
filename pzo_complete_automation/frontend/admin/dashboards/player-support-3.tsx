import React from 'react';
import { Row, Col, Card } from 'antd';
import PlayerSupportChart from './PlayerSupportChart';
import PlayerSupportTable from './PlayerSupportTable';

const PlayerSupportDashboard = () => (
<div>
<Row gutter={16}>
<Col span={12}>
<Card title="Player Support Overview">
<PlayerSupportChart />
</Card>
</Col>
<Col span={12}>
<Card title="Detailed Player Support">
<PlayerSupportTable />
</Card>
</Col>
</Row>
</div>
);

export default PlayerSupportDashboard;
