import React from 'react';
import { Layout, Menu } from 'antd';
import 'antd/dist/antd.css';

const { Header, Content, Sider } = Layout;

interface Props {}

const AdminShell6: React.FC<Props> = () => (
<Layout>
<Sider style={{ overflow: 'auto' }}>
<Menu mode="inline" defaultSelectedKeys={['1']}>
<Menu.Item key="1">Dashboard</Menu.Item>
<Menu.Item key="2">Users</Menu.Item>
<Menu.Item key="3">Settings</Menu.Item>
</Menu>
</Sider>
<Layout style={{ paddingLeft: 200 }}>
<Header />
<Content style={{ padding: 24, minHeight: 360 }}>
{/* Replace with your content */}
<div>Welcome to Admin Shell 6</div>
</Content>
</Layout>
</Layout>
);

export default AdminShell6;
