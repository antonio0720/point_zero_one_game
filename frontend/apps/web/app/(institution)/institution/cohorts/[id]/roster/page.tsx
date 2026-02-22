/**
 * Roster Page Component for CSV upload, validation preview, and dedupe reporting.
 */

import React, { useState } from 'react';
import { Button, Table, Modal, Form, Input, Message } from 'antd';
import { UploadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { CsvReader } from 'csv-reader';
import axios from 'axios';

interface RosterData {
  id: number;
  name: string;
  institutionId: number;
  cohortId: number;
}

const RosterPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RosterData[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<RosterData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Institution ID', dataIndex: 'institutionId', key: 'institutionId' },
    { title: 'Cohort ID', dataIndex: 'cohortId', key: 'cohortId' },
  ];

  const handleOk = () => {
    setPreviewVisible(false);
  };

  const handleCancel = () => {
    setPreviewVisible(false);
  };

  const handlePreview = (item: RosterData) => {
    setPreviewItem(item);
    setPreviewVisible(true);
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMessage('Please select a CSV file.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const reader = new CsvReader();
      const results = await reader.readFileAndParse(file);

      let validData: RosterData[] = [];

      results.forEach((row) => {
        if (row.length === 4 && !isNaN(+row[0]) && !isNaN(+row[1]) && !isNaN(+row[2])) {
          const data: RosterData = {
            id: Number(row[0]),
            name: row[1],
            institutionId: Number(row[2]),
            cohortId: Number(row[3]),
          };
          validData.push(data);
        } else {
          setErrorMessage('Invalid CSV format. Each row should have 4 columns and all values should be numbers.');
        }
      });

      if (validData.length > 0) {
        setData(validData);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage('An error occurred while reading the CSV file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Roster</h1>
      <div style={{ marginBottom: 16 }}>
        <UploadOutlined />
        <Button type="primary" onClick={() => document.getElementById('fileInput')?.click()}>
          Upload CSV
        </Button>
        <input id="fileInput" type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
      </div>
      {errorMessage && <Message type="error" content={errorMessage} />}
      <Table dataSource={data} columns={columns} pagination={false} />
      {data.length > 0 && (
        <>
          <Button type="primary" onClick={handleUpload}>
            Validate and Preview
          </Button>
          <Modal title="Preview" visible={previewVisible} onOk={handleOk} onCancel={handleCancel}>
            <Table dataSource={[previewItem]} columns={columns} pagination={false} />
          </Modal>
        </>
      )}
    </div>
  );
};

export default RosterPage;
