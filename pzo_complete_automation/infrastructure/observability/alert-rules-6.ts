In this example, the `prometheus.yml` file is used to define the alert rule. The `my-service` label should be replaced with the appropriate service name monitored by Prometheus.

Additionally, here's an example of creating a corresponding dashboard in Grafana Loki using the same metric:

```json
variables:
service: my-service

panels:
- title: Response Time Overview
timeFrom: ${timeFrom_relative}
timeShift: -${timeShift_relative}
interval: ${interval_default}
datasource: prometheus
graphTitle: Average response time of requests for service: ${service}
gridPos:
y: 0
x: 0
w: 24
h: 8
panelId: 1
type: gauge
metrics:
- label: Average Response Time
helpText: The average response time of requests for service ${service}
refId: response_time-avg
query: avg(http_response_time{job="prometheus", service=${service}})
- label: Max Response Time
helpText: The maximum response time of requests for service ${service}
refId: response_time-max
query: max(http_response_time{job="prometheus", service=${service}})
style:
gauge:
valueFontSize: 30px
decimals: 2
thresholdBorderWidth: 1.5px
thresholdColor: red

- title: Response Time Histogram
timeFrom: ${timeFrom_relative}
timeShift: -${timeShift_relative}
interval: ${interval_default}
datasource: prometheus
graphTitle: Histogram of response times for service: ${service}
gridPos:
y: 8
x: 0
w: 24
h: 8
panelId: 2
type: histogram
metrics:
- label: Response Time Histogram
refId: response_time-histogram
query: http_response_time_bucket{job="prometheus", service=${service}}
style:
histogram:
binSize: 50ms
