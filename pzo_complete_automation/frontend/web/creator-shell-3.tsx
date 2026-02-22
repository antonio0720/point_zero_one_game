import * as React from 'react';
import styled from 'styled-components';

const Container = styled.div`
display: flex;
height: 100vh;
width: 100%;
justify-content: center;
align-items: center;
background-color: #f5f5f5;
`;

const Shell = styled.div`
border: 1px solid #ccc;
padding: 20px;
max-width: 800px;
`;

const Input = styled.input`
width: 100%;
margin-bottom: 10px;
`;

const Button = styled.button`
padding: 5px 10px;
background-color: #4CAF50;
color: white;
border: none;
cursor: pointer;
`;

interface Props {}

interface State {
inputValue: string;
}

class CreatorShell3 extends React.Component<Props, State> {
constructor(props: Props) {
super(props);
this.state = { inputValue: '' };
}

handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
this.setState({ inputValue: e.target.value });
};

handleButtonClick = () => {
// Handle button click and execute command with `exec`
// For example, using child_process in Node.js:
// const { exec } = require('child_process');
// exec(this.state.inputValue);
};

render() {
return (
<Container>
<Shell>
<Input value={this.state.inputValue} onChange={this.handleInputChange} />
<Button onClick={this.handleButtonClick}>Execute</Button>
</Shell>
</Container>
);
}
}

export default CreatorShell3;
