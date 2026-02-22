import * as React from 'react';
import { Row, Col, Button, Form, Input } from 'antd';
import ScenarioDataContext from '../../contexts/ScenarioDataContext';
import { Scenario } from '../../interfaces';
import { addScenario } from '../../actions';

interface Props {}

const { TextArea } = Input;

class ScenarioBuilder1 extends React.Component<Props> {
static contextType = ScenarioDataContext;

constructor(props: Props) {
super(props);
this.state = {
name: '',
description: '',
steps: [],
nextScenarioBuilderIndex: -1,
};
}

handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
const name = e.target.value;
this.setState({ name });
};

handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
const description = e.target.value;
this.setState({ description });
};

handleAddStepClick = () => {
this.setState((prevState) => ({
steps: [...prevState.steps, ''],
}));
};

handleRemoveStepClick = (index: number) => {
this.setState((prevState) => ({
steps: prevState.steps.filter((_, i) => i !== index),
}));
};

handleStepChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
const newSteps = [...this.state.steps];
newSteps[index] = e.target.value;
this.setState({ steps: newSteps });
};

handleSubmitClick = () => {
const scenario: Scenario = {
name: this.state.name,
description: this.state.description,
steps: this.state.steps,
};
this.context.dispatch(addScenario(scenario));
};

render() {
const { name, description, steps } = this.state;
return (
<Form>
<Row gutter={16}>
<Col span={8}>
<Form.Item label="Scenario Name">
<Input value={name} onChange={this.handleNameChange} />
</Form.Item>
</Col>
<Col span={16}>
<Form.Item label="Description">
<TextArea rows={4} value={description} onChange={this.handleDescriptionChange} />
</Form.Item>
</Col>
</Row>
{steps.map((step, index) => (
<Row key={index}>
<Col span={20}>
<Form.Item label={`Step ${index + 1}`}>
<Input value={step} onChange={(e) => this.handleStepChange(index, e)} />
</Form.Item>
</Col>
<Col span={4}>
{steps.length > 1 && (
<Button onClick={() => this.handleRemoveStepClick(index)}>Remove</Button>
)}
</Col>
</Row>
))}
<Row>
<Col offset={20}>
<Button onClick={this.handleAddStepClick}>Add Step</Button>
</Col>
</Row>
<Row>
<Col offset={16}>
<Button type="primary" onClick={this.handleSubmitClick}>
Submit
</Button>
</Col>
</Row>
</Form>
);
}
}

export default ScenarioBuilder1;
