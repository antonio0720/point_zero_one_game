import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

interface User {
id: number;
signupDate: Date;
}

interface Cohort {
startDate: Date;
endDate: Date;
users: User[];
}

@Injectable()
export class CohortAnalysisService {
analyzeCohorts(startDates: Date[], endDates: Date[]): Observable<Cohort[]> {
return from(startDates).pipe(
withLatestFrom(from(endDates)),
map(([startDate, endDate]) => ({ startDate, endDate })),
switchMap(cohort =>
this.userService.getUsers().pipe(
tap(users => users.forEach(user => user.signupDate = new Date(user.signupDate))),
map(users => {
const cohortUsers = users.filter(user => user.signupDate >= cohort.startDate && user.signupDate <= cohort.endDate);
return { ...cohort, users: cohortUsers };
})
)
)
);
}

constructor(private userService: UserService) {}
}

@Injectable()
class UserService {
getUsers(): Observable<User[]> {
// Mock data or actual API call for retrieving users
return of([
{ id: 1, signupDate: new Date('2021-01-01') },
{ id: 2, signupDate: new Date('2021-02-01') },
{ id: 3, signupDate: new Date('2021-03-01') },
// Add more users
]);
}
}

function from<T>(array: T[]): Observable<T> {
return of(array);
}

function withLatestFrom<T, U>(observable: Observable<T>) {
return observable.pipe(
switchMap(value => observable2 => observable2.pipe(map((secondValue) => [value, secondValue] as const)))
);
}
