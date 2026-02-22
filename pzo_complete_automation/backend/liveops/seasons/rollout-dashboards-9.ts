import { Component } from '@angular/core';
import { RolloutService } from '../services/rollout.service';

@Component({
selector: 'app-rollout-dashboards-9',
templateUrl: './rollout-dashboards-9.component.html',
styleUrls: ['./rollout-dashboards-9.component.scss']
})
export class RolloutDashboards9Component {
rollouts: any[];

constructor(private rolloutService: RolloutService) {}

ngOnInit(): void {
this.getRollouts();
}

private getRollouts(): void {
this.rolloutService.getRollouts().subscribe((rollouts) => {
this.rollouts = rollouts;
});
}
}
