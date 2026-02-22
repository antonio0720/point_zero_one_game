import React from 'react';
import { useEffect } from 'react';
import { StyledShell, InputContainer, Terminal } from './styles';
import { ITerminalProps } from './types';

const WebShell9: React.FC<ITerminalProps> = ({ width, height }) => {
const [input, setInput] = React.useState('');
const [output, setOutput] = React.useState('');

useEffect(() => {
// Fetch the user input and update the output state here
if (input) {
// Call your API or execute command logic here
const apiResponse = /* Your command execution result */;
setOutput(output => `${output}\n${apiResponse}`);
}
}, [input]);

return (
<StyledShell width={width} height={height}>
<Terminal.container>
<Terminal.header>Web Shell</Terminal.header>
<InputContainer>
<Terminal.input value={input} onChange={e => setInput(e.target.value)} />
<Terminal.button>&#8594;</Terminal.button>
</InputContainer>
<Terminal.output>{output}</Terminal.output>
</Terminal.container>
</StyledShell>
);
};

export default WebShell9;

// styles.ts
export const StyledShell = styled.div`
width: ${({ width }) => width}px;
height: ${({ height }) => height}px;
border: 1px solid #ccc;
border-radius: 4px;
padding: 8px;
box-sizing: border-box;
`;

export const Terminal = {
container: styled.div`` as any,
header: styled.h2`
margin: 0 0 8px;
`,
input: styled.input`
width: calc(100% - 36px);
padding: 4px 8px;
border-radius: 4px;
border: none;
font-size: 14px;
resize: vertical;
`,
button: styled.button`
width: 32px;
height: 32px;
border: none;
border-radius: 50%;
background-color: #f5f5f5;
cursor: pointer;
font-size: 18px;
line-height: 32px;
text-align: center;
`,
output: styled.pre`
margin: 0;
padding: 0;
color: #777;
white-space: pre-wrap;
font-family: 'Consolas', 'Menlo', monospace;
font-size: 14px;
`,
};

// types.ts
export interface ITerminalProps {
width: number;
height: number;
}
