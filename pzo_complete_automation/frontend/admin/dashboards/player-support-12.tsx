import React from 'react';
import { Row, Col, Card, Table } from 'antd';
import { UserOutlined, TagOutlined, EllipsisOutlined } from '@ant-design/icons';

interface DataType {
key: string;
name: string;
age: number;
address: string;
tags: Array<{
key: string;
label: string;
}>;
}

const columns = [
{
title: 'Name',
dataIndex: 'name',
key: 'name',
render: (text: string) => <a>{text}</a>,
},
{
title: 'Age',
dataIndex: 'age',
key: 'age',
},
{
title: 'Address',
dataIndex: 'address',
key: 'address',
},
{
title: 'Tags',
key: 'tags',
dataIndex: 'tags',
render: (tags: any) => (
<span>
{tags.map((tag) => {
let color = tag.label === 'loser' ? 'volcano' : 'geekblue';
return (
<Tag key={tag.key} color={color} style={{ marginRight: 3 }}>
{tag.label}
</Tag>
);
})}
</span>
),
},
];

const data: DataType[] = [
{
key: '1',
name: 'John Brown',
age: 32,
address: 'New York No. 1 Lake Park',
tags: [{ key: 'loser', label: 'Loser' }, { key: 'geek', label: 'Geek' }],
},
{
key: '2',
name: 'Jim Green',
age: 42,
address: 'London No. 1 Lake Park',
tags: [{ key: 'loser', label: 'Loser' }],
},
{
key: '3',
name: 'Joe Black',
age: 32,
address: 'Sidney No. 1 Lake Park',
tags: [{ key: 'geek', label: 'Geek' }],
},
];

const PlayerSupportDashboard12: React.FC = () => (
<Row gutter={16}>
<Col span={12}>
<Card title="Player List">
<Table columns={columns} dataSource={data} />
</Card>
</Col>
<!-- Add more cards as needed -->
</Row>
);

export default PlayerSupportDashboard12;
