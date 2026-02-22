import React from 'react';
import { Dashboard as AntDashboard, Card, Statistic } from 'antd';

const PlayerSupport8 = () => {
const { Meta } = AntDashboard;

const dataSource = [
{
title: 'Total Players',
value: '12345',
icon: <i className="bi bi-people" />,
},
{
title: 'Active Players',
value: '5678',
icon: <i className="bi bi-people-fill" />,
},
{
title: 'Offline Players',
value: '3210',
icon: <i className="bi bi-people-x" />,
},
{
title: 'Players with Issues',
value: '9876',
icon: <i className="bi bi-exclamation-circle-fill" />,
},
];

return (
<AntDashboard title="Player Support Dashboard">
<Meta
title="Overview"
description="Monitor the players and their status in real-time."
/>
<Card title="Player Statistics" bordered={false}>
{dataSource.map((item, index) => (
<Statistic key={index} title={item.title} value={item.value} prefix={item.icon} />
))}
</Card>
</AntDashboard>
);
};

export default PlayerSupport8;
