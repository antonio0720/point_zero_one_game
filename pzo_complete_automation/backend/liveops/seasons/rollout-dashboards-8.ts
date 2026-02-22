import { Component, OnInit } from '@angular/core';
import { RolloutService } from '../services/rollout.service';

@Component({
selector: 'app-rollout-dashboards-8',
templateUrl: './rollout-dashboards-8.component.html',
styleUrls: ['./rollout-dashboards-8.component.scss']
})
export class RolloutDashboards8Component implements OnInit {
rollouts: any[];

constructor(private rolloutService: RolloutService) {}

ngOnInit() {
this.loadRollouts();
}

loadRollouts() {
this.rolloutService.getRollouts().subscribe((rolloutsData) => {
this.rollouts = rolloutsData;
});
}
}
