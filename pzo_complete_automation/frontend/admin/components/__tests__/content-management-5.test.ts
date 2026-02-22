import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentManagement5Component } from './content-management-5.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';

describe('ContentManagement5Component', () => {
let component: ContentManagement5Component;
let fixture: ComponentFixture<ContentManagement5Component>;
let httpMock: HttpTestingController;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ ContentManagement5Component ],
imports: [HttpClientTestingModule],
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(ContentManagement5Component);
component = fixture.componentInstance;
httpMock = TestBed.inject(HttpTestingController);
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more test cases here...

});
