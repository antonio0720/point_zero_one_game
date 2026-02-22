import { Component } from '@angular/core';
import * as chartjs from 'chart.js';

@Component({
selector: 'app-dashboards-1',
template: `
<canvas #chart></canvas>
`,
})
export class Dashboards1Component {
chart: any;

ngAfterViewInit(): void {
const ctx = document.getElementById('chart') as HTMLCanvasElement;
this.chart = new Chart(ctx, {
type: 'bar',
data: {
labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple'],
datasets: [{
label: '# of Votes',
data: [12, 19, 3, 5, 2],
backgroundColor: ['rgba(255, 99, 132)', 'rgba(54, 162, 235)', 'rgba(255, 206, 86)', 'rgba(75, 192, 192)', 'rgba(153, 102, 255)'],
borderColor: ['rgba(255, 99, 132)', 'rgba(54, 162, 235)', 'rgba(255, 206, 86)', 'rgba(75, 192, 192)', 'rgba(153, 102, 255)'],
borderWidth: 1
}]
},
options: {
scales: {
y: {
beginAtZero: true
}
}
}
});
}
}
