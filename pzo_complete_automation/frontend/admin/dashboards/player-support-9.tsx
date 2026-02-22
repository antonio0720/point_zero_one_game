import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { Typography } from '@material-ui/core';

const useStyles = makeStyles({
table: {
minWidth: 650,
},
});

interface PlayerSupportData {
id: number;
name: string;
email: string;
status: string;
}

const playerSupportData: PlayerSupportData[] = [
// ... your data here
];

export default function PlayerSupportDashboard9() {
const classes = useStyles();

return (
<Paper>
<Typography variant="h4" component="h1">
Player Support Dashboard 9
</Typography>
<TableContainer component={Paper}>
<Table className={classes.table} aria-label="player support table">
<TableHead>
<TableRow>
<TableCell>ID</TableCell>
<TableCell align="left">Name</TableCell>
<TableCell align="left">Email</TableCell>
<TableCell align="left">Status</TableCell>
</TableRow>
</TableHead>
<TableBody>
{playerSupportData.map((row) => (
<TableRow key={row.id}>
<TableCell component="th" scope="row">
{row.id}
</TableCell>
<TableCell align="left">{row.name}</TableCell>
<TableCell align="left">{row.email}</TableCell>
<TableCell align="left">{row.status}</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</TableContainer>
</Paper>
);
}
