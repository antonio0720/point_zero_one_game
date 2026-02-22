class Postmortem {
id!: string;
title!: string;
description!: string;
timestamp!: Date;
rootCause!: string;
correctiveActions!: string[];
preventativeActions!: string[];

constructor(params: {
id?: string;
title?: string;
description?: string;
timestamp?: Date;
rootCause?: string;
correctiveActions?: string[];
preventativeActions?: string[];
}) {
this.id = params.id || uuidv4();
this.title = params.title || "";
this.description = params.description || "";
this.timestamp = params.timestamp || new Date();
this.rootCause = params.rootCause || "";
this.correctiveActions = params.correctiveActions || [];
this.preventativeActions = params.preventativeActions || [];
}
}
