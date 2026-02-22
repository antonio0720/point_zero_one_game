import React from 'react';
import { Chart, Line, Bar, Pie } from 'react-chartjs-2';
import {
Chart as ChartJS,
CategoryScale,
LinearScale,
PointElement,
LineElement,
BarElement,
RadialLinearScale,
Title,
Tooltip,
Legend,
} from 'chart.js';

ChartJS.register(
CategoryScale,
LinearScale,
PointElement,
LineElement,
BarElement,
RadialLinearScale,
Title,
Tooltip,
Legend
);

interface Economy10Props {
data: {
labels: string[];
datasets: {
label: string;
data: number[];
type: 'line' | 'bar' | 'pie';
}[];
};
}

const Economy10: React.FC<Economy10Props> = ({ data }) => {
const options = {
responsive: true,
plugins: {
title: {
display: true,
text: 'Economy-10 Dashboard',
},
},
};

const lineOptions = {
...options,
scales: {
y: {
beginAtZero: true,
},
},
};

const barOptions = {
...options,
scales: {
x: {
stacked: true,
},
},
};

const pieOptions = {
...options,
plugins: {
legend: false,
},
};

return (
<>
<Line options={lineOptions} data={data.find((d) => d.type === 'line') as any} />
<Bar options={barOptions} data={data.find((d) => d.type === 'bar') as any} />
{data.find((d) => d.type === 'pie') && (
<Pie options={pieOptions} data={data.find((d) => d.type === 'pie') as any} />
)}
</>
);
};

export default Economy10;
