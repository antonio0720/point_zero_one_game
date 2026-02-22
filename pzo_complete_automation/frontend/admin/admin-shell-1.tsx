import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
root: {
display: 'flex',
height: '100vh',
},
}));

function AdminShell() {
const classes = useStyles();

return (
<div className={classes.root}>
{/* Your admin shell content goes here */}
</div>
);
}

export default AdminShell;
