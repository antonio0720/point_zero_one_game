import { Component, OnInit } from '@angular/core';
import { Observable, mergeMap, of } from 'rxjs';
import { Store, select } from '@ngrx/store';
import * as LiveOpsActions from './liveops.actions';
import { Select, StoreSelector } from '@ngrx/store';
import { LiveOpsState, Rollout } from './liveops.reducer';
import { map } from 'rxjs/operators';

@Component({
selector: 'app-rollout-dashboards-4',
templateUrl: './rollout-dashboards-4.component.html',
styleUrls: ['./rollout-dashboards-4.component.css']
})
export class RolloutDashboards4Component implements OnInit {
@Select(selectRollouts) rollouts$: Observable<Rollout[]>;

constructor(private store: Store<LiveOpsState>) {}

ngOnInit(): void {
this.store.dispatch(LiveOpsActions.loadRollouts());
}

loadMoreData(): void {
this.store.dispatch(LiveOpsActions.loadMoreRollouts());
}
}

function selectRollouts(state: LiveOpsState): Rollout[] {
return state.rollouts;
}
