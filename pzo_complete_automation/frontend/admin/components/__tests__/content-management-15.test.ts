import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentManagement15Component } from './content-management-15.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

describe('ContentManagement15Component', () => {
let component: ContentManagement15Component;
let fixture: ComponentFixture<ContentManagement15Component>;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ ContentManagement15Component ],
imports: [HttpClientTestingModule],
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(ContentManagement15Component);
component = fixture.componentInstance;
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more specific tests for content-management-15 as needed
});
