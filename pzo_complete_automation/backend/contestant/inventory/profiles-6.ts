import { Injectable } from '@angular/core';
import { ContestantProfile } from './contestant-profile.model';

@Injectable({
providedIn: 'root'
})
export class ProfilesService {

private profiles: ContestantProfile[] = [
// Sample contestant profiles
{ id: 1, name: 'Contestant A', imageUrl: '/assets/images/contestant-a.jpg' },
{ id: 2, name: 'Contestant B', imageUrl: '/assets/images/contestant-b.jpg' },
// Add more contestants as needed
];

getProfiles(): ContestantProfile[] {
return this.profiles;
}

addProfile(profile: ContestantProfile): void {
this.profiles.push(profile);
}

updateProfile(id: number, updates: Partial<ContestantProfile>): void {
const index = this.profiles.findIndex((p) => p.id === id);
if (index !== -1) {
this.profiles[index] = { ...this.profiles[index], ...updates };
}
}

deleteProfile(id: number): void {
const index = this.profiles.findIndex((p) => p.id === id);
if (index !== -1) {
this.profiles.splice(index, 1);
}
}
}
