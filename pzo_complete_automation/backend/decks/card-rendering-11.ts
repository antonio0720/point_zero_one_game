import { Component, Input } from '@angular/core';
import { CardData } from '../models/card-data.model';

@Component({
selector: 'app-card',
template: `
<div class="card">
<div class="front" *ngIf="!showBack">
<h3>{{ cardData.title }}</h3>
<p>{{ cardData.description }}</p>
</div>
<div class="back" *ngIf="showBack">
<button (click)="flipCard()">Flip Card</button>
</div>
</div>
`,
styles: [
`
.card {
width: 200px;
height: 300px;
perspective: 1000px;
}

.card > div {
backface-visibility: hidden;
position: absolute;
left: 0;
top: 0;
width: 100%;
height: 100%;
border-radius: 5px;
transition: transform 0.8s;
}

.front {
transform: rotateY(0deg);
}

.back {
transform: rotateY(180deg);
}
`,
],
})
export class CardComponent {
@Input() cardData!: CardData;
showBack = false;

flipCard() {
this.showBack = !this.showBack;
}
}
