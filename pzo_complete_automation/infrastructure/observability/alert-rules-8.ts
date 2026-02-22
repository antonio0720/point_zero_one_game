1. prometheus.rules.yml

```yaml
groups:
- name: CPUUsage
rules:
- alert: HighCPU
annotations:
description: "CPU usage exceeded threshold"
message: "The CPU usage is {{ $labels.instance }} and the value is {{ $value }}"
expr: avg by (instance) (irate(kube_pod_container_status_cpu_usage_seconds_total{job!='kube-state-metrics', container!_exporter=~'node|prometheus'}[1m])) > 80
for: 30s
labels:
severity: critical

- name: MemoryUsage
rules:
- alert: HighMemory
annotations:
description: "Memory usage exceeded threshold"
message: "The memory usage is {{ $labels.instance }} and the value is {{ $value }} bytes"
expr: sum by (instance) (gauge_memory_MemTotal_bytes{job!='kube-state-metrics', container!_exporter=~'node|prometheus'}) - sum by (instance) (gauge_memory_MemFree_bytes{job!='kube-state-metrics', container!_exporter=~'node|prometheus'}) > 80%
for: 30s
labels:
severity: critical
```

2. alertmanager.yml

```yaml
global:
resolve_timeout: 5m
smarthost: "smarthost:9074"
route:
receiver: my-alertmanager-receiver
group_by: ['alertname', 'severity']
group_wait: 30s
group_interval: 5m
routes:
- match:
alertname: HighCPU
severity: critical
receiver: pagerduty
- match:
alertname: HighMemory
severity: critical
receiver: pagerduty
receivers:
- name: prometheus
to_slack: "slack-url"
slack_configs:
- channel: "#alerts"
send_resolved: true
- channel: "#general"
send_failed: true

routes:
- match:
alertname: HighCPU
severity: critical
route:
group_by: ['alertname', 'severity']
group_wait: 30s
group_interval: 5m
routes:
- match:
recipient: "pagerduty"
handler: action_slack_message

- match:
alertname: HighMemory
severity: critical
route:
group_by: ['alertname', 'severity']
group_wait: 30s
group_interval: 5m
routes:
- match:
recipient: "pagerduty"
handler: action_slack_message
```

3. Grafana Loki Stack configuration files (not included due to size limitations, check official documentation for more information)
