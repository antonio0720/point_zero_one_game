/**
 * Admin Ops Board UI - Daily Snapshot Viewer + Notes + Drilldowns
 */

import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Input, Button } from 'antd';
import dayjs from 'dayjs';
import { DatabaseOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

interface DailySnapshot {
  id: number;
  date: dayjs.Dayjs;
  balance: number;
  notes?: string;
}

interface Props {}

const { TextArea } = Input;

const AdminOpsBoardPage: React.FC<Props> = () => {
  const [data, setData] = useState<DailySnapshot[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    // Fetch data from the server (using fetch or axios) and update state
  }, []);

  const handleAddNote = () => {
    // Add new note to the server and refresh data
  };

  const handleEditNote = (id: number, note: string) => {
    // Update note on the server for a specific id and refresh data
  };

  const handleDeleteNote = (id: number) => {
    // Delete note on the server for a specific id and refresh data
  };

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card title="Daily Snapshots" extra={<DatabaseOutlined />}>
          <Table dataSource={data} rowKey="id">
            {columns.map((column) => (
              <Column key={column.key} {...column} />
            ))}
          </Table>
        </Card>
      </Col>
      <Col span={16}>
        <Card title="Notes" extra={<DatabaseOutlined />}>
          <Row justify="space-between">
            <Col>
              <TextArea rows={4} value={newNote} onChange={(e) => setNewNote(e.target.value)} />
            </Col>
            <Col>
              {editingId !== null ? (
                <Button onClick={() => handleEditNote(editingId, newNote)}>Save</Button>
              ) : (
                <Button onClick={handleAddNote}>Add Note</Button>
              )}
            </Col>
          </Row>
          {data.map((snapshot) => (
            <Row key={snapshot.id} justify="space-between">
              <Col>{dayjs(snapshot.date).format('YYYY-MM-DD')}</Col>
              <Col>
                {editingId === snapshot.id ? (
                  <Input value={snapshot.notes || ''} onChange={(e) => setNewNote(e.target.value)} />
                ) : (
                  snapshot.notes
                )}
              </Col>
              <Col>
                {editingId === null && (
                  <Button onClick={() => setEditingId(snapshot.id)}>Edit</Button>
                )}
                {editingId === snapshot.id && (
                  <>
                    <Button onClick={() => handleEditNote(snapshot.id, newNote)}>Save</Button>
                    <Button onClick={() => setEditingId(null)}>Cancel</Button>
                  </>
                )}
                {editingId !== snapshot.id && (
                  <Button onClick={() => handleDeleteNote(snapshot.id)} danger>
                    Delete
                  </Button>
                )}
              </Col>
            </Row>
          ))}
        </Card>
      </Col>
    </Row>
  );
};

const columns = [
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Balance', dataIndex: 'balance', key: 'balance' },
];

export default AdminOpsBoardPage;
