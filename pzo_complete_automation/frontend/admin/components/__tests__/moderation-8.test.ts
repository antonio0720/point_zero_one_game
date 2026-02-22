import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Moderation8Component } from './moderation-8.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

describe('Moderation8Component', () => {
let component: Moderation8Component;
let fixture: ComponentFixture<Moderation8Component>;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ Moderation8Component ],
imports: [ HttpClientModule, FormsModule ]
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(Moderation8Component);
component = fixture.componentInstance;
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more specific tests here
});
