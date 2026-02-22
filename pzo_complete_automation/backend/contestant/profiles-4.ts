interface Profile {
id: number;
name: string;
description: string;
}

class Contestant {
private _profiles: Profile[] = [];

addProfile(profile: Profile) {
this._profiles.push(profile);
}

get profiles(): Profile[] {
return this._profiles.slice(); // Return a shallow copy of the profiles array
}

removeProfile(id: number): void {
this._profiles = this._profiles.filter((p) => p.id !== id);
}
}
