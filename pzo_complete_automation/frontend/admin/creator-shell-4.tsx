import React from 'react';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
root: {
flexGrow: 1,
display: 'flex',
height: '100vh',
overflow: 'auto',
backgroundColor: theme.palette.background.default,
},
content: {
padding: theme.spacing(2),
},
}));

interface Props {
children: React.ReactNode;
}

const CreatorShell4 = (props: Props) => {
const classes = useStyles();

return (
<div className={classes.root}>
<aside className={classes.drawerSide}>...</aside>
<main className={classes.content}>{props.children}</main>
</div>
);
};

export default CreatorShell4;
