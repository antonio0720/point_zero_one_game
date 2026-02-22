import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Moderation3Component } from './moderation-3.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('Moderation3Component', () => {
let component: Moderation3Component;
let fixture: ComponentFixture<Moderation3Component>;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ Moderation3Component ],
schemas: [CUSTOM_ELEMENTS_SCHEMA],
imports: [HttpClientTestingModule]
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(Moderation3Component);
component = fixture.componentInstance;
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more test cases for specific functionality here
});
