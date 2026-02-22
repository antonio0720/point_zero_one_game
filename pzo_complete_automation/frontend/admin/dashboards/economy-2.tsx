import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import axios from 'axios';

const useStyles = makeStyles({
table: {
minWidth: 650,
},
});

interface Data {
name: string;
country: string;
gdp: number;
population: number;
}

interface ApiResponse {
data: Data[];
}

const EconomyDashboard2: React.FC = () => {
const classes = useStyles();
const [data, setData] = React.useState<Data[]>([]);

React.useEffect(() => {
const fetchData = async () => {
try {
const response = await axios.get('https://api.example.com/economy');
setData(response.data.data);
} catch (error) {
console.error(`Error: ${error}`);
}
};

fetchData();
}, []);

return (
<TableContainer component={Paper}>
<Table className={classes.table} aria-label="simple table">
<TableHead>
<TableRow>
<TableCell>Name</TableCell>
<TableCell align="right">Country</TableCell>
<TableCell align="right">GDP ($ billions)</TableCell>
<TableCell align="right">Population (millions)</TableCell>
</TableRow>
</TableHead>
<TableBody>
{data.map((row) => (
<TableRow key={row.name}>
<TableCell component="th" scope="row">
{row.name}
</TableCell>
<TableCell align="right">{row.country}</TableCell>
<TableCell align="right">${row.gdp.toFixed(2)}</TableCell>
<TableCell align="right">{row.population.toLocaleString()}</TableCell>
</TableRow>
))}
</TableBody>
</Table>
</TableContainer>
);
};

export default EconomyDashboard2;
