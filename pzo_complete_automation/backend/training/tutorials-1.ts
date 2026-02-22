import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TutorialService } from './tutorial.service';

@Component({
selector: 'app-onboarding',
templateUrl: './onboarding.component.html',
styleUrls: ['./onboarding.component.css']
})
export class OnboardingComponent implements OnInit {
step = 1;
tutorialSteps = [
{
title: 'Welcome to MyApp!',
content: `Congratulations on joining us! MyApp is a platform designed to help you ...`,
actionLabel: 'Next',
actionRoute: '/onboarding/2'
},
{
title: 'Your Dashboard',
content: `The dashboard is the first page you see after logging in. Here, you can access various features of MyApp...`,
actionLabel: 'Next',
actionRoute: '/onboarding/3'
},
{
title: 'Creating a New Item',
content: `Learn how to create and manage items within MyApp. From this page, you can create new items...`,
actionLabel: 'Finish',
actionRoute: '/onboarding/finish'
},
];

constructor(private tutorialService: TutorialService, private route: ActivatedRoute, private router: Router) {}

ngOnInit(): void {
this.tutorialService.setTutorialSteps(this.tutorialSteps);
const currentStep = +this.route.snapshot.params['step'];
if (currentStep > this.tutorialSteps.length) {
this.router.navigate(['/onboarding/1']);
return;
}
this.step = currentStep;
}

next() {
const newStep = this.step + 1;
if (newStep <= this.tutorialSteps.length) {
this.router.navigate([`/onboarding/${newStep}`]);
} else {
this.tutorialService.completeTutorial();
this.router.navigate(['/']);
}
}
}
