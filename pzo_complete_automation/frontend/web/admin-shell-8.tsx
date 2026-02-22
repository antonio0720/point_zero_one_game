import React from 'react';
import { Row, Col } from 'antd';
import { MenuUnfoldOutlined, MenuFoldOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';

const AdminShell = () => {
const [collapsed, setCollapsed] = React.useState(false);

return (
<Row type="flex" justify="space-around" align="middle" height="100vh">
<Col span={4}>
<div style={{ height: '100%', padding: 24, background: '#3f51b5', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
<MenuUnfoldOutlined onClick={() => setCollapsed(false)} />
<MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ marginTop: 16 }} />
</div>
</Col>
<Col span={18} style={{ background: '#f0f2f5', padding: 24 }}>
<Row type="flex" justify="end">
<Col>
<UserOutlined /> {/* User icon */}
</Col>
<Col>
<LockOutlined /> {/* Lock icon */}
</Col>
</Row>
{/* Your content goes here */}
</Col>
</Row>
);
};

export default AdminShell;
