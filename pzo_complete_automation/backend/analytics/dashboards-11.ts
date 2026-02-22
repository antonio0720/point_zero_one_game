import { Component, OnInit } from '@angular/core';
import { ChartDataSets, ChartOptions } from 'chart.js';
import { Color, Label } from 'ng2-charts';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

interface SeriesData {
label: string;
data: number[];
}

@Component({
selector: 'app-dashboards-11',
templateUrl: './dashboards-11.component.html',
})
export class Dashboards11Component implements OnInit {
public lineChartData: ChartDataSets[] = [
{ label: 'Series A', data: [], backgroundColor: 'rgba(255, 99, 132, 0.5)', borderColor: 'rgba(255, 99, 132, 1)' },
// Add more series as needed
];

public lineChartLabels: Label[] = [];

public lineChartOptions: ChartOptions = {
responsive: true,
scales: {
xAxes: [{ display: true, scaleLabel: { display: true } }],
yAxes: [{ display: true, scaleLabel: { display: true } }],
},
};

public lineChartColors: Color[] = [
{
borderColor: 'rgba(255, 99, 132, 1)',
backgroundColor: 'rgba(255, 99, 132, 0.5)',
},
// Add more series colors as needed
];

public lineChartLegend = true;

constructor() {}

ngOnInit(): void {
// Simulated observable for fetching data from an API
const apiData$: Observable<SeriesData[]> = of([
{ label: 'Series A', data: [1, 2, 3, 4, 5] },
// Add more series as needed
]);

apiData$
.pipe(
map((data) =>
data.map((series) => {
const seriesObj: ChartDataSets = {
label: series.label,
data: series.data,
backgroundColor: this.lineChartColors[0],
borderColor: this.lineChartColors[1],
};
return seriesObj;
})
),
switchMap((seriesData) => {
this.lineChartLabels = Array.from({ length: seriesData.length }, (_, i) => `Label ${i + 1}`);
return of(seriesData);
}),
tap(() => console.log('Data fetched and processed'))
)
.subscribe((seriesData) => {
this.lineChartData = seriesData;
});
}
}
