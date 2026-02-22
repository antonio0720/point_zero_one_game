import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

interface Rollout {
id: string;
name: string;
status: string;
}

@Injectable({
providedIn: 'root'
})
export class RolloutDashboardService {
private rollouts: Rollout[] = [
// Sample data for demonstration purposes
{ id: 'r1', name: 'Rollout 1', status: 'In Progress' },
{ id: 'r2', name: 'Rollout 2', status: 'Completed' }
];

getRollouts(): Observable<Rollout[]> {
return new Observable((observer) => {
observer.next(this.rollouts);
observer.complete();
});
}
}
