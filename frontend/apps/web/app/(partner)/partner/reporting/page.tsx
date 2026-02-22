/**
 * Reporting Dashboard - Engagement, Retention, Cohort Comparisons, Exports, QBR Pack Download
 */

import React, { useEffect, useState } from 'react';
import { Column, Row } from '@ant-design/grid';
import { Table, Space, Button, Modal, Form, Input, Select } from 'antd';
import moment from 'moment';

interface ReportData {
  date: string;
  engagement: number;
  retention: number;
}

interface CohortData {
  cohortId: number;
  startDate: string;
  endDate: string;
  engagement: number;
  retention: number;
}

const ReportingPage: React.FC = () => {
  const [data, setData] = useState<ReportData[]>([]);
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetch('/api/reporting')
      .then((res) => res.json())
      .then((data) => {
        setData(data.engagementRetention);
        setCohortData(data.cohorts);
        setIsLoading(false);
      });
  }, []);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        // Handle form submission here
        console.log('Received values:', values);
        setIsModalVisible(false);
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
      });
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const columns = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Engagement', dataIndex: 'engagement', key: 'engagement' },
    { title: 'Retention', dataIndex: 'retention', key: 'retention' },
  ];

  const cohortColumns = [
    { title: 'Cohort ID', dataIndex: 'cohortId', key: 'cohortId' },
    { title: 'Start Date', dataIndex: 'startDate', key: 'startDate' },
    { title: 'End Date', dataIndex: 'endDate', key: 'endDate' },
    { title: 'Engagement', dataIndex: 'engagement', key: 'engagement' },
    { title: 'Retention', dataIndex: 'retention', key: 'retention' },
  ];

  return (
    <div>
      <Row gutter={16}>
        <Column span={12}>
          <Table columns={columns} dataSource={data} loading={isLoading} />
        </Column>
        <Column span={12}>
          <Button type="primary" onClick={showModal}>
            Add Cohort
          </Button>
          <Table columns={cohortColumns} dataSource={cohortData} />
        </Column>
      </Row>
      <Modal title="Add Cohort" visible={isModalVisible} onOk={handleOk} onCancel={handleCancel}>
        <Form form={form} initialValues={{ remember: true }}>
          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true, message: 'Please input the start date!' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="endDate"
            label="End Date"
            rules={[{ required: true, message: 'Please input the end date!' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReportingPage;
