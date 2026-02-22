import { Component, OnInit } from '@angular/core';
import { MatStepperSelectionEvent } from '@angular/material/stepper';
import { StepperOrientation } from '@angular/material/stepper/models';

@Component({
selector: 'app-progressive-disclosure-3',
templateUrl: './progressive-disclosure-3.component.html',
styleUrls: ['./progressive-disclosure-3.component.css']
})
export class ProgressiveDisclosure3Component implements OnInit {
stepperOrientation: StepperOrientation = 'horizontal';
isLinear: boolean = false;
selectedStep: number = 0;

steps = [
{ title: 'Step 1', content: 'Content for Step 1' },
{ title: 'Step 2', content: 'Content for Step 2' },
{ title: 'Step 3', content: 'Content for Step 3' }
];

constructor() {}

ngOnInit(): void {}

onSelectionChange(event: MatStepperSelectionEvent): void {
this.selectedStep = event.selectedIndex;
}
}
