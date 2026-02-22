import { DataTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

const sequelize = new Sequelize({
dialect: 'postgres',
host: process.env.DB_HOST,
port: Number(process.env.DB_PORT),
username: process.env.DB_USERNAME,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
models: [__dirname + '/models'], // path to your Sequelize models
dialectOptions: {
ssl: true,
},
});

sequelize.authenticate()
.then(() => console.log('Connection has been established successfully.'))
.catch((error) => console.error('Unable to connect to the database:', error));

// Example Model for FactTable (dimensions and measures)
export interface FactTableAttributes {
id: number;
dimension_id: number;
measure: number | string;
createdAt?: Date;
updatedAt?: Date;
}

export const FactTable = sequelize.define<FactTableModel, FactTableAttributes>('FactTable', {
id: {
type: DataTypes.INTEGER,
primaryKey: true,
autoIncrement: true,
},
dimension_id: {
type: DataTypes.INTEGER,
allowNull: false,
references: {
model: 'Dimension', // name of the Dimension model
key: 'id', // primaryKey of the Dimension model
},
},
measure: {
type: DataTypes.NUMERIC(18, 2),
allowNull: false,
},
}, { timestamps: true });
