/**
 * Institution Page Component for Authoring UI (admin-only)
 */

import React, { useState } from 'react';
import { Button, Form, Input, Select } from 'antd';
import { Draft, Scenario, Rubric, Benchmark } from '../../types';

type Props = {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
};

const { Option } = Select;

const InstitutionPage: React.FC<Props> = ({ draft, setDraft }) => {
  const [scenarios, setScenarios] = useState(draft.scenarios || []);
  const [rubric, setRubric] = useState(draft.rubric || {});
  const [benchmarks, setBenchmarks] = useState(draft.benchmarks || []);

  const handleAddScenario = () => {
    setScenarios([...scenarios, {} as Scenario]);
  };

  const handleRemoveScenario = (index: number) => {
    setScenarios(scenarios.filter((_, i) => i !== index));
  };

  const handleAddRubricItem = () => {
    setRubric({ ...rubric, [Object.keys(rubric).length + 1]: '' });
  };

  const handleRemoveRubricItem = (key: string) => {
    const newRubric = { ...rubric };
    delete newRubric[key];
    setRubric(newRubric);
  };

  const handleAddBenchmark = () => {
    setBenchmarks([...benchmarks, {} as Benchmark]);
  };

  const handleRemoveBenchmark = (index: number) => {
    setBenchmarks(benchmarks.filter((_, i) => i !== index));
  };

  return (
    <Form>
      <Form.Item label="Draft">
        <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
      </Form.Item>

      <Form.List name="scenarios">
        {scenarios.map((_, index) => (
          <Form.Item key={index} label={`Scenario ${index + 1}`}>
            <Input value={scenarios[index].name} onChange={e => setScenarios(prev => prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s))) } />
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="dashed" onClick={handleAddScenario}>
            Add Scenario
          </Button>
        </Form.Item>
      </Form.List>

      {scenarios.map((_, index) => (
        <Form.List name={`rubric.${index}`} key={`rubric-${index}`}>
          {Object.entries(rubric[index] || {}).map(([key, value]) => (
            <Form.Item key={key} label={`Rubric Item ${key + 1}`}>
              <Input value={value} onChange={e => setRubric({ ...rubric, [index]: { ...rubric[index], [key]: e.target.value } })} />
              <Button type="text" onClick={() => handleRemoveRubricItem(key)}>
                Remove
              </Button>
            </Form.Item>
          ))}
          <Form.Item>
            <Button type="dashed" onClick={() => handleAddRubricItem()}>
              Add Rubric Item
            </Button>
          </Form.Item>
        </Form.List>
      ))}

      <Form.List name="benchmarks">
        {benchmarks.map((_, index) => (
          <Form.Item key={index} label={`Benchmark ${index + 1}`}>
            <Input value={benchmarks[index].name} onChange={e => setBenchmarks(prev => prev.map((b, i) => (i === index ? { ...b, name: e.target.value } : b))) } />
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="dashed" onClick={handleAddBenchmark}>
            Add Benchmark
          </Button>
        </Form.Item>
      </Form.List>

      <Form.Item>
        <Button type="primary" onClick={() => console.log('Publish')}>
          Publish
        </Button>
      </Form.Item>
    </Form>
  );
};

export default InstitutionPage;
