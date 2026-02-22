import React from 'react';
import { Row, Col, Card, Table } from 'antd';

interface ColumnsType {
key: string;
title: React.ReactNode;
dataIndex: string;
render?: (text: any) => React.ReactNode;
}

const columns: ColumnsType[] = [
{
title: 'ID',
dataIndex: 'id',
},
// Add more columns as needed
];

interface DataType {
key: string;
id: number;
// Add more properties as needed
}

const data: DataType[] = [
// Add your data here
];

const Economy5 = () => (
<Card title="Economy-5 Dashboard">
<Table columns={columns} dataSource={data} />
</Card>
);

export default Economy5;
