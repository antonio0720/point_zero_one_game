import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { TrainingService } from '../services/training.service';

@Component({
selector: 'app-tutorials-10',
templateUrl: './tutorials-10.component.html',
styleUrls: ['./tutorials-10.component.css']
})
export class Tutorials10Component implements OnInit {

user!: any;

constructor(private router: Router, private userService: UserService, private trainingService: TrainingService) { }

ngOnInit(): void {
this.user = this.userService.getUser();

if (!this.user) {
this.router.navigate(['/login']);
return;
}

this.trainingService.startTraining(10);
}
}
