import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chartjs-adapter';
import axios from 'axios';

ChartJS.register(ArcElement, Tooltip, Legend);

interface EconomyData {
label: string;
value: number;
}

const EconomyDashboard7 = () => {
const [economyData, setEconomyData] = useState<EconomyData[]>([]);

useEffect(() => {
const fetchData = async () => {
try {
const response = await axios.get('/api/economy-data');
setEconomyData(response.data);
} catch (error) {
console.error(error);
}
};

fetchData();
}, []);

const options = {
// Chart configuration goes here
};

return (
<div>
{economyData.length > 0 && (
<canvas id="chart" width={600} height={400} />
)}
</div>
);
};

export default EconomyDashboard7;
