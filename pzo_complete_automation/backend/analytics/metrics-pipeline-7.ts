import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';

@Injectable()
export class MetricsPipeline7Service {
processMetrics(metrics$: Observable<any>): Observable<any> {
return metrics$.pipe(
// Assuming you have a custom processor function for each metric type.
map((metric) => processMetricTypeA(metric)),
mergeMap((processedA) =>
of(processedA).pipe(
tap(() => console.log('Processed Metric A')),
map((processedA) => processMetricTypeB(processedA))
)
),
mergeMap((processedB) =>
of(processedB).pipe(
tap(() => console.log('Processed Metric B')),
map((processedB) => processMetricTypeC(processedB))
)
),
// Add more processors as needed.
// ...
mergeMap((finalMetrics) =>
of(finalMetrics).pipe(
tap(() => console.log('Final Metrics')),
map((metrics) => ({ metrics })),
// Implement logic to send the metrics to your analytics service here.
)
),
);
}

private processMetricTypeA(metric: any): any {
// Your custom processing logic for Metric A goes here.
}

private processMetricTypeB(processedA: any): any {
// Your custom processing logic for Metric B goes here.
}

private processMetricTypeC(processedB: any): any {
// Your custom processing logic for Metric C goes here.
}
}
