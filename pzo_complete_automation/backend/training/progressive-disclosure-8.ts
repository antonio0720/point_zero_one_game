import { Component, OnInit } from '@angular/core';
import { TrainingService } from '../services/training.service';
import { User } from '../models/user';
import { MatTabGroup, MatTabChangeEvent } from '@angular/material/tabs';

@Component({
selector: 'app-progressive-disclosure-8',
templateUrl: './progressive-disclosure-8.component.html',
styleUrls: ['./progressive-disclosure-8.component.scss']
})
export class ProgressiveDisclosure8Component implements OnInit {
user: User;
currentStep = 1;
tabs: Array<{ title: string, content: string }> = [
{ title: 'Introduction', content: '' },
{ title: 'Basics', content: '' },
{ title: 'Intermediate', content: '' },
{ title: 'Advanced', content: '' },
];

constructor(private trainingService: TrainingService) {}

ngOnInit(): void {
this.user = this.trainingService.getUser();
this.setInitialContent();
}

setInitialContent() {
if (!this.user) return;
if (this.user.onboardingStep === 1) {
this.tabs[0].content = 'Welcome to our application!';
} else if (this.user.onboardingStep <= 4) {
const stepIndex = this.user.onboardingStep - 1;
this.currentStep = stepIndex + 1;
this.tabs[stepIndex].content = `Onboarding Step ${this.currentStep}: Learn about...`;
} else if (this.user.completedTraining) {
this.tabs[3].content = 'Congratulations! You have completed your training.';
}
}

onTabChange(event: MatTabChangeEvent, tabGroup: MatTabGroup) {
if (tabGroup._selectedIndex === this.tabs.length - 1 && !this.user.completedTraining) {
this.markAsCompleted();
}
}

markAsCompleted() {
this.trainingService.markAsCompleted();
this.setInitialContent();
}
}
