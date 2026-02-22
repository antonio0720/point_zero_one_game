import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Economy9Component } from './economy-9.component';
import { HttpClientModule } from '@angular/common/http';
import { of } from 'rxjs';

describe('Economy9Component', () => {
let component: Economy9Component;
let fixture: ComponentFixture<Economy9Component>;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ Economy9Component ],
imports: [ HttpClientModule ]
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(Economy9Component);
component = fixture.componentInstance;
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more test cases as needed

});
