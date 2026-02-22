```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { LiveOpsService } from '../live-ops.service';
import { Rollout } from '../models/rollout';

@Component({
selector: 'app-rollout-dashboards-7',
templateUrl: './rollout-dashboards-7.component.html',
styleUrls: ['./rollout-dashboards-7.component.scss']
})
export class RolloutDashboards7Component implements OnInit {

rollouts$: Observable<Rollout[]>;

constructor(private liveOpsService: LiveOpsService, private route: ActivatedRoute, private router: Router) {}

ngOnInit(): void {
this.rollouts$ = this.liveOpsService.getRollouts();
}
}
```

This code creates a new Angular component named `RolloutDashboards7Component`. It initializes an observable called `rollouts$` that will contain the list of rollouts fetched from the LiveOps service. When the component is initialized, it subscribes to this observable. The templateUrl and styleUrls properties are set for defining HTML and CSS files for the component.

In your app-routing.module.ts, make sure you have a route defined:

```typescript
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RolloutDashboards7Component } from './rollout-dashboards-7/rollout-dashboards-7.component';

const routes: Routes = [
{ path: 'rollouts/dashboard/7', component: RolloutDashboards7Component },
];

@NgModule({
imports: [RouterModule.forRoot(routes)],
exports: [RouterModule]
})
export class AppRoutingModule {}
```

Make sure to import necessary dependencies in your app.module.ts and the RolloutDashboards7Component module (wherever you create it).

In your LiveOpsService, you'll need to implement a `getRollouts()` method that returns an observable of rollouts:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Rollout } from '../models/rollout';

@Injectable({
providedIn: 'root'
})
export class LiveOpsService {

private baseUrl = '/api/liveops';

constructor(private http: HttpClient) {}

getRollouts(): Observable<Rollout[]> {
return this.http.get<Rollout[]>(`${this.baseUrl}/rollouts`);
}
}
```
