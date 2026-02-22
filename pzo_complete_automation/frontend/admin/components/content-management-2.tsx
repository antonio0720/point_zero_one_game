import * as React from 'react';
import { Row, Col, Input, Button } from 'antd';

interface Props {}

interface State {
title: string;
content: string;
}

class ContentManagement2 extends React.Component<Props, State> {
constructor(props: Props) {
super(props);
this.state = {
title: '',
content: '',
};
}

handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
this.setState({ title: e.target.value });
};

handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
this.setState({ content: e.target.value });
};

handleSaveClick = () => {
// Save the data to the backend here
console.log('Saving', this.state);
};

render() {
const { title, content } = this.state;
return (
<Row>
<Col span={12}>
<Input
value={title}
onChange={this.handleTitleChange}
placeholder="Title"
/>
</Col>
<Col span={12}>
<Input.TextArea
value={content}
onChange={this.handleContentChange}
rows={4}
placeholder="Content"
/>
</Col>
<Col span={6}>
<Button onClick={this.handleSaveClick}>Save</Button>
</Col>
</Row>
);
}
}

export default ContentManagement2;
