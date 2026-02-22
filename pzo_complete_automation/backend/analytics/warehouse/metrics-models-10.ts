import { Entity, ManyToOne, Column, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { User } from "./user.entity";
import { Activity } from "./activity.entity";

@Entity()
export class MetricsModel10 {
@PrimaryGeneratedColumn()
id: number;

@ManyToOne(type => User, user => user.metricsModels10)
user: User;

@OneToMany(type => Activity, activity => activity.metricsModel10)
activities: Activity[];

@Column({ type: "float" })
averageSessionLength: number;

@Column({ type: "int", default: 0 })
totalPageViews: number;

@Column({ type: "int", default: 0 })
totalActivities: number;
}
