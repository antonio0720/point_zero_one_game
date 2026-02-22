import React from 'react';
import { Row, Col } from 'antd';

interface ParentalDashboardProps {}

const ParentalDashboard: React.FC<ParentalDashboardProps> = () => {
return (
<div>
<h1>Parental Dashboard</h1>
<Row gutter={16}>
<Col span={8}>
<div>Consent Management</div>
</Col>
<Col span={8}>
<div>Content Filters</div>
</Col>
<Col span={8}>
<div>Activity Tracking</div>
</Col>
</Row>
</div>
);
};

export default ParentalDashboard;
