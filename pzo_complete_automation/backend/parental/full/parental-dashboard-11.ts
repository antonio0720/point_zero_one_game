Here's a simplified TypeScript example of a Parental Dashboard component using Angular. Please note that this is a basic example and may not include all your required features.

```typescript
import { Component } from '@angular/core';

@Component({
selector: 'app-parental-dashboard',
templateUrl: './parental-dashboard.component.html',
styleUrls: ['./parental-dashboard.component.scss']
})
export class ParentalDashboardComponent {
constructor() {}

checkAge(birthdate: Date): boolean {
const age = new Date().getFullYear() - birthdate.getFullYear();
const monthDiff = new Date(new Date().setFullYear(new Date().getFullYear() + 1) - birthdate).getMonth();
return age >= 18 || monthDiff > 0;
}
}
```

In this example, the `ParentalDashboardComponent` checks if a user is over 18 years old based on their birthdate. You can modify the age limit or add more functionalities as needed.

```html
<!-- parental-dashboard.component.html -->
<div *ngIf="!checkAge(userBirthdate)">
Age gating: You must be over 18 to access this dashboard.
</div>
<div *ngIf="checkAge(userBirthdate)">
<!-- Your parental dashboard content -->
</div>
```

Don't forget to define `userBirthdate` in your component or service, depending on your application structure.

```typescript
import { Component } from '@angular/core';

@Component({
selector: 'app-parental-dashboard',
templateUrl: './parental-dashboard.component.html',
styleUrls: ['./parental-dashboard.component.scss']
})
export class ParentalDashboardComponent {
userBirthdate = new Date('1995-06-23'); // replace with actual birthdate from your data source

constructor() {}

checkAge(birthdate: Date): boolean {
const age = new Date().getFullYear() - birthdate.getFullYear();
const monthDiff = new Date(new Date().setFullYear(new Date().getFullYear() + 1) - birthdate).getMonth();
return age >= 18 || monthDiff > 0;
}
}
```
