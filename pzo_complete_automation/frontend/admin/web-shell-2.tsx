import React from 'react';
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { TextAreaAutosize, Button } from '@material-ui/core';

interface Props {}

const WebShell2: React.FC<Props> = () => {
const [files, setFiles] = useState<File[]>([]);
const [output, setOutput] = useState<string>("");

const onDrop = useDropzone({ onDrop, accept: '.sh' });

// Function to execute the commands in the files and update output state.
const executeCommands = () => {
// Execute command logic using child_process or similar library.
// Update output state with the result.
};

return (
<div>
<div {...onDrop.getRootProps()}>
<input {...onDrop.getInputProps()} />
{onDrop.isDragActive ? (
<p>Drop the files here ...</p>
) : (
<p>Drag and drop .sh files here, or click to select files</p>
)}
</div>
<TextAreaAutosize
value={output}
readOnly
style={{ fontSize: 14 }}
/>
<Button onClick={executeCommands}>Execute Commands</Button>
</div>
);
};

export default WebShell2;
