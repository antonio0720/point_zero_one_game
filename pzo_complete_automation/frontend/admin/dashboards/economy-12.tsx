import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import axios from 'axios';

const useStyles = makeStyles({
table: {
minWidth: 650,
},
});

interface EconomyData {
id: number;
country: string;
gdp: number;
inflationRate: number;
unemploymentRate: number;
}

const fetchEconomyData = async () => {
try {
const response = await axios.get('/api/economy-data');
return response.data as EconomyData[];
} catch (error) {
console.error(error);
}
};

export default function EconomyDashboard() {
const classes = useStyles();
const [data, setData] = React.useState<EconomyData[]>([]);

React.useEffect(() => {
(async () => {
const fetchedData = await fetchEconomyData();
setData(fetchedData);
})();
}, []);

return (
<TableContainer>
<Table className={classes.table} aria-label="economy data table">
<TableHead>
<TableRow>
<TableCell>Country</TableCell>
<TableCell align="right">GDP</TableCell>
<TableCell align="right">Inflation Rate</TableCell>
<TableCell align="right">Unemployment Rate</TableCell>
</TableRow>
</TableHead>
<TableBody>
{data.map((row) => (
<TableRow key={row.id}>
<TableCell component="th" scope="row">
{row.country}
</TableCell>
<TableCell align="right">{row.gdp}</TableCell>
<TableCell align="right">{row.inflationRate}</TableCell>
<TableCell align="right">{row.unemploymentRate}</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</TableContainer>
);
}
