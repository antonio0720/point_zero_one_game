import * as React from 'react';
import { Admin, Resource } from 'react-admin';
import jsonServerProvider from '@web-guys/ra-data-json-server';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import { makeStyles } from '@material-ui/styles';

const useStyles = makeStyles({
root: {
flexGrow: 1,
},
});

interface Props {}

const AdminShell5: React.FC<Props> = () => {
const classes = useStyles();

return (
<div className={classes.root}>
<AppBar position="static">
<Toolbar>
<IconButton edge="start" color="inherit" aria-label="menu">
<MenuIcon />
</IconButton>
<Admin title="My Admin App">
<Resource name="resources" list={false} />
</Admin>
</Toolbar>
</AppBar>
</div>
);
};

export default AdminShell5;
