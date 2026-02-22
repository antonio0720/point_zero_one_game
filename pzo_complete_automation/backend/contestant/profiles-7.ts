export interface Contact {
firstName: string;
lastName: string;
email: string;
phoneNumber: string;
}

export interface SocialMedia {
facebook?: string;
twitter?: string;
instagram?: string;
linkedIn?: string;
}

export class ContestantProfile {
id: number;
firstName: string;
lastName: string;
dateOfBirth: Date;
contact: Contact;
socialMedia: SocialMedia;
biography: string;
pictureUrl?: string;

constructor(
id: number,
firstName: string,
lastName: string,
dateOfBirth: Date,
contact: Contact,
socialMedia: SocialMedia,
biography: string,
pictureUrl?: string
) {
this.id = id;
this.firstName = firstName;
this.lastName = lastName;
this.dateOfBirth = dateOfBirth;
this.contact = contact;
this.socialMedia = socialMedia;
this.biography = biography;
this.pictureUrl = pictureUrl || '';
}
}
