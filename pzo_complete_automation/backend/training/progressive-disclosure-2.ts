Component (progressive-disclosure-2.component.ts):

```typescript
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
selector: 'app-progressive-disclosure-2',
templateUrl: './progressive-disclosure-2.component.html',
styleUrls: ['./progressive-disclosure-2.component.scss']
})
export class ProgressiveDisclosure2Component {
@Input() isStep1Visible = true;
@Input() isStep2Visible = false;
@Output() onStep2VisibleChange = new EventEmitter<boolean>();

toggleStep2Visibility(): void {
this.isStep1Visible = !this.isStep1Visible;
this.isStep2Visible = !this.isStep2Visible;
this.onStep2VisibleChange.emit(this.isStep2Visible);
}
}
```

Service (progressive-disclosure-2.service.ts):

```typescript
import { Injectable } from '@angular/core';

@Injectable({
providedIn: 'root'
})
export class ProgressiveDisclosure2Service {
public emitStep2VisibleChange(visible: boolean): void {
this.progressiveDisclosure2Subject.next(visible);
}

private readonly progressiveDisclosure2Subject = new Subject<boolean>();

observeStep2Visibility(): Observable<boolean> {
return this.progressiveDisclosure2Subject.asObservable();
}

constructor() {}
}
```

This code includes a `ProgressiveDisclosure2Component` with an input for controlling the visibility of step 1 and step 2, as well as an output for emitting the change in step 2's visibility. Also, there is a `ProgressiveDisclosure2Service` that allows components to emit and observe changes in step 2's visibility through observables.
