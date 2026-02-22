```typescript
import { Component, OnInit } from '@angular/core';
import { LiveOpsService } from '../services/live-ops.service';
import { Observable } from 'rxjs';
import { Rollout, Environment, FeatureFlag } from '../models';

@Component({
selector: 'app-rollout-dashboards-12',
templateUrl: './rollout-dashboards-12.component.html',
styleUrls: ['./rollout-dashboards-12.component.scss']
})
export class RolloutDashboards12Component implements OnInit {

rollouts$: Observable<Rollout[]>;
environments$: Observable<Environment[]>;
featureFlags$: Observable<FeatureFlag[]>;

constructor(private liveOpsService: LiveOpsService) {}

ngOnInit(): void {
this.rollouts$ = this.liveOpsService.getRollouts();
this.environments$ = this.liveOpsService.getEnvironments();
this.featureFlags$ = this.liveOpsService.getFeatureFlags();
}
}
```

In this example, we have a component named `RolloutDashboards12Component`. It depends on the following imports:

- `@angular/core` for Angular Core components and services
- A custom service `LiveOpsService` which should handle API calls to fetch data for rollouts, environments, and feature flags
- RxJS's Observable for asynchronous data handling

The component has the following properties:

- `rollouts$`, `environments$`, and `featureFlags$` that hold the observable streams of the corresponding data from the LiveOps service.

In the constructor, we inject the `LiveOpsService`. In the `ngOnInit()` method, we subscribe to the observables and set their values to the corresponding properties.

The component's HTML template and SCSS files are in separate files: `rollout-dashboards-12.component.html` and `rollout-dashboards-12.component.scss`, respectively.
