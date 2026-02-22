class RegulatoryFiling8 {
private id: number;
private filingName: string;
private submissionDate: Date;
private status: string;
private associatedForms: any[]; // This could be a more specific type depending on the forms

constructor(id: number, filingName: string, submissionDate: Date, status: string, associatedForms: any[]) {
this.id = id;
this.filingName = filingName;
this.submissionDate = submissionDate;
this.status = status;
this.associatedForms = associatedForms;
}

getId(): number {
return this.id;
}

setId(id: number): void {
this.id = id;
}

getFilingName(): string {
return this.filingName;
}

setFilingName(filingName: string): void {
this.filingName = filingName;
}

getSubmissionDate(): Date {
return this.submissionDate;
}

setSubmissionDate(submissionDate: Date): void {
this.submissionDate = submissionDate;
}

getStatus(): string {
return this.status;
}

setStatus(status: string): void {
this.status = status;
}

getAssociatedForms(): any[] {
return this.associatedForms;
}

setAssociatedForms(associatedForms: any[]): void {
this.associatedForms = associatedForms;
}
}
