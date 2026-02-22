import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';

const useStyles = makeStyles((theme) => ({
root: {
flexGrow: 1,
},
title: {
flexGrow: 1,
},
}));

function ParentalDashboard() {
const classes = useStyles();

return (
<div className={classes.root}>
<AppBar position="static">
<Toolbar>
<Typography variant="h6" className={classes.title}>
Parental Dashboard
</Typography>
</Toolbar>
</AppBar>
<main>
<Grid container spacing={3}>
{/* Add your child cards here */}
<Grid item xs={12} sm={6} md={4}>
<Card>
<CardContent>
<Typography variant="h5" component="h2">
Child 1
</Typography>
<Typography variant="body2" color="textSecondary">
Last accessed: 04/03/2023
</Typography>
</CardContent>
</Card>
</Grid>
</Grid>
</main>
</div>
);
}

export default ParentalDashboard;
