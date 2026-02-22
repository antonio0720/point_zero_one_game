import {
Column,
CreatedAt,
DataType,
Model,
Table,
UpdatedAt,
} from 'sequelize-typescript';
import { Sequelize } from 'sequelize';
import { MetricsModel1Attributes, MetricsModel1CreationAttributes } from './metrics-model-1.interface';

@Table({ tableName: 'metrics_model_1' })
export class MetricsModel1 extends Model<
MetricsModel1Attributes,
MetricsModel1CreationAttributes
> {
@Column({
type: DataType.INTEGER,
primaryKey: true,
autoIncrement: true,
})
id: number;

@Column({
type: DataType.FLOAT,
allowNull: false,
})
value: number;

@Column({
type: DataType.DATEONLY,
allowNull: false,
})
date: Date;

@CreatedAt
createdAt!: Date;

@UpdatedAt
updatedAt!: Date;

static init(sequelize: Sequelize) {
return super.init(
{},
{
sequelize,
tableName: 'metrics_model_1',
timestamps: true,
}
);
}
}
