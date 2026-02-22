```typescript
import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';

@Component({
selector: 'app-card',
standalone: true,
imports: [MatCardModule, MatIconModule],
templateUrl: './card.component.html',
styleUrls: ['./card.component.css']
})
export class CardComponent {
@Input() title!: string;
@Input() subtitle!: string;
@Input() icon!: string;

constructor() {}
}
```

```html
<!-- card.component.html -->
<mat-card class="card">
<div fxLayout="row" fxFlexWrap="wrap" fxLayoutAlign="start center">
<mat-icon [svgIcon]="icon" class="icon"></mat-icon>
<div fxLayout="column" fxFlexFill fxLayoutAlign="start stretch">
<h2>{{ title }}</h2>
<p>{{ subtitle }}</p>
</div>
</div>
</mat-card>
```

```css
/* card.component.css */
.card {
display: flex;
align-items: center;
padding: 20px;
}

.icon {
font-size: 48px;
margin-right: 16px;
}
```

This code creates a reusable card component that accepts `title`, `subtitle`, and `icon` inputs, and uses them to render the card with an icon, title, and subtitle. The CSS styles are defined for customizing the appearance of the card.
