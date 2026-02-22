import { TestBed } from '@angular/core/testing';
import { Spikey } from 'lombok-ts';
import { AppComponent } from './app.component';

@Spikey({ durationSeconds: 60, iterations: 100 })
export class SpikeTest {
constructor() {
TestBed.configureTestingModule({ imports: [AppModule] });
}

ngOnInit() {
// Perform load and stress tests on your application here.
// For example, you can create multiple instances of AppComponent and perform actions on them simultaneously.

const components = Array(100).fill(null).map(() => TestBed.createComponent(AppComponent));

components.forEach((comp) => {
comp.detectChanges();

// Perform actions like clicks, typing, etc., on the created instances here.
});
}
}
