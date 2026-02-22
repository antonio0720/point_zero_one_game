import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OnboardingService } from '../services/onboarding.service';

@Component({
selector: 'app-tutorials-2',
templateUrl: './tutorials-2.component.html',
styleUrls: ['./tutorials-2.component.scss']
})
export class Tutorials2Component {
tutorialData: any;

constructor(
private route: ActivatedRoute,
private onboardingService: OnboardingService,
private router: Router
) {}

ngOnInit(): void {
const tutorialId = this.route.snapshot.params['id'];
this.onboardingService.getTutorial(tutorialId).subscribe((data) => {
this.tutorialData = data;
});
}
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

@Injectable({
providedIn: 'root'
})
export class OnboardingService {
private apiUrl = 'api-url/onboarding';

constructor(private http: HttpClient) {}

getTutorial(id: number): Observable<any> {
return this.http.get(`${this.apiUrl}/tutorials/${id}`);
}
}
