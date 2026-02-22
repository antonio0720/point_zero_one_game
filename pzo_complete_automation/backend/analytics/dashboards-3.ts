import { Analytics, User, Event } from 'analytics';

class Dashboard3 {
private analytics: Analytics;

constructor() {
this.analytics = new Analytics();
}

createDashboard() {
// User count by country chart
const userCountryChart = this.analytics.createBarChart('User Country', 'Count');
this.analytics.addDataToChart(userCountryChart, 'country', 'Users');

// Event type distribution chart
const eventTypeChart = this.analytics.createPieChart('Event Type Distribution');
this.analytics.addDataToChart(eventTypeChart, 'type', null);

// Daily active users line chart
const dailyActiveUsersChart = this.analytics.createLineChart('Daily Active Users');
this.analytics.addDataToChart(dailyActiveUsersChart, 'date', 'users');
}
}

// Usage
const dashboard3 = new Dashboard3();
dashboard3.createDashboard();
