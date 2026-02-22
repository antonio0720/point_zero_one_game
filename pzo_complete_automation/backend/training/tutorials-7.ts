2. Component: `training-tutorials.component.ts`

```typescript
import { Component, OnInit } from '@angular/core';
import { TrainingTutorialsService } from './training-tutorials.service';

@Component({
selector: 'app-training-tutorials',
templateUrl: './training-tutorials.component.html',
styleUrls: ['./training-tutorials.component.css']
})
export class TrainingTutorialsComponent implements OnInit {
tutorials;

constructor(private trainingService: TrainingTutorialsService) {}

ngOnInit() {
this.trainingService.getTutorials().subscribe((data) => {
this.tutorials = data;
});
}
}
