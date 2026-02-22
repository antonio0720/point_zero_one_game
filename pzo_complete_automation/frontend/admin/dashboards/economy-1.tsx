import React, { useEffect, useState } from 'react';

interface EconomyData {
growthRate: number;
employmentRate: number;
inflationRate: number;
}

const EconomyDashboard = () => {
const [data, setData] = useState<EconomyData>({
growthRate: 0,
employmentRate: 0,
inflationRate: 0,
});

useEffect(() => {
async function fetchData() {
const response = await fetch('/api/economy');
const result = await response.json();
setData(result);
}

fetchData();
}, []);

return (
<div>
<h1>Economy Dashboard</h1>
<section>
<h2>Growth Rate:</h2>
<p>{data.growthRate}%</p>
</section>
<section>
<h2>Employment Rate:</h2>
<p>{data.employmentRate}%</p>
</section>
<section>
<h2>Inflation Rate:</h2>
<p>{data.inflationRate}%</p>
</section>
</div>
);
};

export default EconomyDashboard;
