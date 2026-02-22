import { Component } from '@angular/core';
import * as am4core from '@amcharts/amcharts4';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

@Component({
selector: 'app-dashboard12',
templateUrl: './dashboards-12.component.html',
styleUrls: ['./dashboards-12.component.scss']
})
export class Dashboards12Component {

private chart: am4charts.XYChart;

ngOnInit() {
am4core.useTheme(am4themes_animated);

this.chart = am4core.XYChart.newInstance('chartdiv', {
data: [{
"date": new Date(2018, 0, 1),
"visits": 3000
}, {
"date": new Date(2018, 0, 2),
"visits": 4000
}, {
"date": new Date(2018, 0, 3),
"visits": 5000
}],
dateFormatter: am4charts.dateFormatters.ddMM,
series: [
{
dataFields: {
valueY: 'visits',
dateX: 'date'
},
name: 'Visitors'
}
]
});
}
}
