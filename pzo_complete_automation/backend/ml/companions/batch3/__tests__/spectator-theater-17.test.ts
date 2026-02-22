import { TestBed } from '@angular/core/testing';
import { SpectatorTheater17Component } from './spectator-theater-17.component';
import { SpectatorTheaterService } from '../../services/spectator-theater.service';
import { of } from 'rxjs';

describe('SpectatorTheater17Component', () => {
let component: SpectatorTheater17Component;
let spectatorTheaterService: SpectatorTheaterService;

beforeEach(() => {
TestBed.configureTestingModule({
declarations: [SpectatorTheater17Component],
providers: [
{ provide: SpectatorTheaterService, useValue: jasmine.createSpies('SpectatorTheaterService') }
]
});

component = TestBed.inject(SpectatorTheater17Component);
spectatorTheaterService = TestBed.inject(SpectatorTheaterService);
});

it('should create', () => {
expect(component).toBeTruthy();
});

describe('ngOnInit', () => {
it('should call spectatorTheaterService.getShowSchedule and set the result to component.showSchedule', () => {
const showSchedule = ['show1', 'show2'];
spectatorTheaterService.getShowSchedule.and.returnValue(of(showSchedule));

component.ngOnInit();

expect(spectatorTheaterService.getShowSchedule).toHaveBeenCalledTimes(1);
expect(component.showSchedule).toEqual(showSchedule);
});
});
});
