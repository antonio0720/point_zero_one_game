interface IBadge {
id: string;
name: string;
description: string;
imageUrl?: string;
points: number;
}

class Badge {
constructor(private badgeData: IBadge) {}

get id() {
return this.badgeData.id;
}

get name() {
return this.badgeData.name;
}

get description() {
return this.badgeData.description;
}

get imageUrl() {
return this.badgeData.imageUrl;
}

get points() {
return this.badgeData.points;
}
}
