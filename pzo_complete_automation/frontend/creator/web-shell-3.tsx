import React, { useState } from 'react';
import styled from 'styled-components';

const InputArea = styled.input`
width: 100%;
margin-bottom: 1rem;
`;

const OutputArea = styled.pre`
font-family: monospace;
white-space: pre-wrap;
`;

interface Props {
initialOutput?: string[];
}

const WebShell: React.FC<Props> = ({ initialOutput }) => {
const [input, setInput] = useState('');
const [output, setOutput] = useState(initialOutput || []);

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
setOutput([...output, input]);
setInput('');
};

return (
<div>
<form onSubmit={handleSubmit}>
<InputArea value={input} onChange={e => setInput(e.target.value)} />
</form>
<OutputArea>
{output.map((line, index) => (
<span key={index}>{line}\n</span>
))}
</OutputArea>
</div>
);
};

export default WebShell;
