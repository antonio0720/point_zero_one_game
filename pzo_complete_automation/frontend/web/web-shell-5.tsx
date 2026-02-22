import React, { useState } from 'react';
import { Container, Row, Col, Form, InputGroup } from 'react-bootstrap';

interface Props {}

const WebShell5: React.FC<Props> = () => {
const [input, setInput] = useState('');

const handleInputChange = (e: React.FormEvent<HTMLInputElement>) => {
setInput(e.currentTarget.value);
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
e.preventDefault();
// Here you can implement the functionality to process the user input and display the results
console.log('User input:', input);
setInput('');
};

return (
<Container>
<Row>
<Col md={6} offsetMd={3}>
<Form onSubmit={handleSubmit}>
<Form.Group controlId="input">
<InputGroup>
<Form.Control type="text" placeholder="Enter command" value={input} onChange={handleInputChange} />
<InputGroup.Append>
<Button type="submit">Execute</Button>
</InputGroup.Append>
</InputGroup>
</Form.Group>
</Form>
</Col>
</Row>
</Container>
);
};

export default WebShell5;
