import React, { useState } from 'react';
import { Button, Form, Input } from '@material-ui/core';

const PracticeSandbox7 = () => {
const [codeInput, setCodeInput] = useState('');

const handleSubmit = (e) => {
e.preventDefault();
// Add your code here for compiling and running the user's input code
};

return (
<Form onSubmit={handleSubmit}>
<Form.Label>Enter your code here:</Form.Label>
<Input multiline rowsMax={20} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
<Button type="submit" variant="contained" color="primary">
Run Code
</Button>
</Form>
);
};

export default PracticeSandbox7;
