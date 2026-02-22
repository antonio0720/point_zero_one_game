class Postmortem {
id: string;
title: string;
description: string;
date: Date;
recommendations: string[];

constructor(id: string, title: string, description: string, date: Date, recommendations: string[]) {
this.id = id;
this.title = title;
this.description = description;
this.date = date;
this.recommendations = recommendations;
}
}
