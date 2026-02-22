import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
selector: 'app-deck-card',
standalone: true,
imports: [MatCardModule, MatIconModule],
templateUrl: './deck-card.component.html',
styleUrls: ['./deck-card.component.scss']
})
export class DeckCardComponent {
@Input() cardData!: any;
@Input() cardIndex!: number;
@Input() selectedCardIndex!: number;

constructor(private sanitizer: DomSanitizer) {}

getCardClasses(): string[] {
const classes = ['mat-card', 'deck-card'];
if (this.selectedCardIndex === this.cardIndex) {
classes.push('selected');
}
return classes;
}

safeUrl(url: string): any {
return this.sanitizer.bypassSecurityTrustUrl(url);
}
}
