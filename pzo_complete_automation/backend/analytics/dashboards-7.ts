import { Dashboard, Metric, Chart } from 'analytics';

class SalesDashboard extends Dashboard {
constructor() {
super('Sales Dashboard');

this.addMetric(new Metric('Total Sales', 'totalSales'));
this.addMetric(new Metric('Average Order Value', 'averageOrderValue'));
this.addMetric(new Metric('Orders Count', 'ordersCount'));

this.addChart(new Chart('BarChart', {
title: 'Total Sales by Region',
dataKey: 'totalSales',
categoryField: 'region'
}));

this.addChart(new Chart('LineChart', {
title: 'Average Order Value Trend',
dataKey: 'averageOrderValue',
timeSeries: true
}));

this.addChart(new Chart('PieChart', {
title: 'Orders Count by Category',
dataKey: 'ordersCount',
groupField: 'category'
}));
}
}
