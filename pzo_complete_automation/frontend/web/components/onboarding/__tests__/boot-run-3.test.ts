import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BootRun3Component } from './boot-run-3.component';
import { HttpClientModule } from '@angular/common/http';
import { of } from 'rxjs';
import { MockBootRunService } from '../../mocks/mock-boot-run.service';

describe('BootRun3Component', () => {
let component: BootRun3Component;
let fixture: ComponentFixture<BootRun3Component>;
let mockBootRunService: MockBootRunService;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ BootRun3Component ],
imports: [HttpClientModule],
providers: [{ provide: BootRunService, useClass: MockBootRunService }]
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(BootRun3Component);
component = fixture.componentInstance;
mockBootRunService = TestBed.inject(BootRunService);
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

it('should call bootRunService.run() on init', () => {
const spy = spyOn(mockBootRunService, 'run');
fixture.detectChanges();
expect(spy).toHaveBeenCalledTimes(1);
});

it('should display correct messages after bootRunService.run()', () => {
mockBootRunService.messages = [{ message: 'Message 1' }, { message: 'Message 2' }];
const spyOnMessages = spyOn(component, 'displayMessages');
fixture.detectChanges();
expect(spyOnMessages).toHaveBeenCalledTimes(1);
expect(component.messages).toEqual(mockBootRunService.messages);
});

it('should simulate an error from bootRunService.run()', () => {
mockBootRunService.run = jasmine.createSpyObj(['run'], { run: () => of(new Error('Test Error')) });
const spyOnErrorHandler = spyOn(component, 'handleError');
fixture.detectChanges();
expect(spyOnErrorHandler).toHaveBeenCalledTimes(1);
});
});
