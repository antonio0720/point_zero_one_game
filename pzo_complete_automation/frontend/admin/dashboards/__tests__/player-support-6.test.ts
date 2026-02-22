import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerSupport6Component } from './player-support-6.component';
import { HttpClientModule } from '@angular/common/http';
import { of } from 'rxjs';

describe('PlayerSupport6Component', () => {
let component: PlayerSupport6Component;
let fixture: ComponentFixture<PlayerSupport6Component>;

beforeEach(async () => {
await TestBed.configureTestingModule({
declarations: [ PlayerSupport6Component ],
imports: [ HttpClientModule ]
})
.compileComponents();
});

beforeEach(() => {
fixture = TestBed.createComponent(PlayerSupport6Component);
component = fixture.componentInstance;
fixture.detectChanges();
});

it('should create', () => {
expect(component).toBeTruthy();
});

// Add more specific test cases for your component's functionality here
});
