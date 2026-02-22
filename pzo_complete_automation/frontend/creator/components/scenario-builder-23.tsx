import React from 'react';
import { Formik, Field, Form } from 'formik';
import * as Yup from 'yup';
import { Row, Col, Button, Input, Select, DatePicker } from 'antd';

interface ScenarioBuilderProps {
onSubmit: (values: any) => void;
}

const ScenarioBuilder: React.FC<ScenarioBuilderProps> = ({ onSubmit }) => {
const schema = Yup.object().shape({
scenarioName: Yup.string().required('Required'),
startDate: Yup.date().required('Required'),
endDate: Yup.date().required('Required'),
steps: Yup.array().of(
Yup.object().shape({
name: Yup.string().required('Required'),
type: Yup.string().required('Required'),
config: Yup.object().nullable(),
})
),
});

const handleSubmit = (values: any) => {
onSubmit(values);
};

return (
<Formik initialValues={{ scenarioName: '', startDate: null, endDate: null, steps: [] }} validationSchema={schema} onSubmit={handleSubmit}>
{({ values, handleChange, handleSubmit }) => (
<Form>
<Row gutter={16}>
<Col span={8}>
<Field name="scenarioName">
{({ field, form }) => (
<Input
{...field}
placeholder="Scenario Name"
onChange={handleChange}
value={values.scenarioName}
/>
)}
</Field>
</Col>
<Col span={8}>
<Field name="startDate">
{({ field }) => (
<DatePicker format="YYYY-MM-DD" {...field} onChange={handleChange} />
)}
</Field>
</Col>
<Col span={8}>
<Field name="endDate">
{({ field }) => (
<DatePicker format="YYYY-MM-DD" {...field} onChange={handleChange} />
)}
</Field>
</Col>
</Row>
<Row>
<Col span={24}>
<Button type="dashed" onClick={() => values.steps.push({ name: '', type: '', config: null })}>
Add Step
</Button>
</Col>
</Row>
{values.steps.map((step, index) => (
<Row key={index}>
<Col span={12}>
<Field name={`steps[${index}].name`}>
{({ field }) => (
<Input {...field} placeholder="Step Name" onChange={handleChange} />
)}
</Field>
</Col>
<Col span={12}>
<Field name={`steps[${index}].type`}>
{({ field }) => (
<Select {...field} placeholder="Step Type" onChange={handleChange}>
{/* Add step types here */}
</Select>
)}
</Field>
</Col>
</Row>
))}
<Row justify="end">
<Col span={24}>
<Button type="primary" htmlType="submit">
Save Scenario
</Button>
</Col>
</Row>
</Form>
)}
</Formik>
);
};

export default ScenarioBuilder;
