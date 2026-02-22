import { Component } from '@angular/core';
import { EconomyService } from '../../services/economy.service';
import { Observable } from 'rxjs';

@Component({
selector: 'app-economy-11',
templateUrl: './economy-11.component.html',
styleUrls: ['./economy-11.component.css']
})
export class Economy11Component {
economyData$: Observable<any>;

constructor(private economyService: EconomyService) {
this.economyData$ = this.economyService.getEconomyData();
}
}
