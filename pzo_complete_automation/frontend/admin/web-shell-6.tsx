import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import { exec } from 'child_process';

const useStyles = makeStyles({
root: {
flexGrow: 1,
},
});

interface Props {}

const WebShell: React.FC<Props> = () => {
const classes = useStyles();
const [inputValue, setInputValue] = React.useState('');
const [outputValue, setOutputValue] = React.useState('');

const handleCommandChange = (event: React.ChangeEvent<HTMLInputElement>) => {
setInputValue(event.target.value);
};

const handleCommandSubmit = () => {
exec(inputValue, (error, stdout, stderr) => {
if (error) {
console.error(`exec error: ${error}`);
return;
}
setOutputValue(stdout);
});
};

return (
<div className={classes.root}>
<Grid container spacing={3}>
<Grid item xs={12} md={6}>
<TextField
id="standard-multiline-flexible"
label="Command Line"
multiline
rowsMax="4"
value={inputValue}
onChange={handleCommandChange}
margin="normal"
/>
</Grid>
<Grid item xs={12} md={6}>
<Button variant="contained" color="primary" onClick={handleCommandSubmit}>
Run Command
</Button>
</Grid>
</Grid>
<TextField
id="standard-read-only-input"
label="Output"
multiline
rowsMax="4"
variant="outlined"
value={outputValue}
disabled
margin="normal"
/>
</div>
);
};

export default WebShell;
