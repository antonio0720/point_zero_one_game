import { Component, OnInit } from '@angular/core';
import { DashboardService } from './dashboard.service';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

@Component({
selector: 'app-dashboards-6',
templateUrl: './dashboards-6.component.html',
styleUrls: ['./dashboards-6.component.css']
})
export class Dashboards6Component implements OnInit {

chart: am4charts.XYChart;

constructor(private dashboardService: DashboardService) {}

ngOnInit() {
am4core.useTheme(am4themes_animated);

this.chart = am4core.XYChart.newInstance({
data: this.dashboardService.getData(),
paddingRight: 20,
dateFormatter: am4charts.dateFormat.dd.MM.yy,
// ... (add your own chart configurations here)
});

this.configureChart();
}

private configureChart() {
// Adding series
let dataSeries = this.chart.series.push(new am4charts.LineSeries());
dataSeries.dataFields.valueY = 'value';
dataSeries.dataFields.dateX = 'date';
dataSeries.name = 'Data Series 1';
dataSeries.strokeWidth = 2;

// Adding axes
let dateAxis = this.chart.xAxes.push(new am4charts.DateAxis());
dateAxis.dataFields.category = 'date';
dateAxis.renderer.grid.template.location = 0;

let valueAxis = this.chart.yAxes.push(new am4charts.ValueAxis());
valueAxis.renderer.minWidth = 35;

// Adding legend
this.chart.legend = new am4charts.Legend();
}
}
