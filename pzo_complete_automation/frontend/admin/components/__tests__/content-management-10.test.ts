import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentManagement10Component } from './content-management-10.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of } from 'rxjs';

describe('ContentManagement10Component', () => {
let component: ContentManagement10Component;
let fixture: ComponentFixture<ContentManagement10Component>;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ContentManagement10Component],
imports: [HttpClientTestingModule, MatSnackBarModule],
}).compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(ContentManagement10Component);
component = fixture.componentInstance;
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

it('should render content-management-10 correctly', () => {
const compiled = fixture.nativeElement;
expect(compiled.querySelector('.content-management-10')).toBeTruthy();
});

it('should call service function on some event', () => {
const mockService = jasmine.createSpyObj(['someFunction']);
TestBed.overrideComponent(ContentManagement10Component, {
set: {
providers: [
{ provide: YourService, useValue: mockService }
]
}
});
const event = new Event('yourEvent');

component.someMethodThatCallsService(event);

expect(mockService.someFunction).toHaveBeenCalled();
});
});
