import { DataTypes } from 'sequelize';
import { MigrationInterface, QueryInterface } from 'sequelize-cli';

export class UsersTable extends MigrationInterface {
async up(queryInterface: QueryInterface) {
await queryInterface.createTable('users', {
id: {
type: DataTypes.INTEGER,
primaryKey: true,
autoIncrement: true,
allowNull: false,
},
firstName: {
type: DataTypes.STRING(50),
allowNull: false,
},
lastName: {
type: DataTypes.STRING(50),
allowNull: false,
},
email: {
type: DataTypes.STRING,
unique: true,
allowNull: false,
},
password: {
type: DataTypes.STRING,
allowNull: false,
},
createdAt: {
type: DataTypes.DATEONLY,
allowNull: false,
},
updatedAt: {
type: DataTypes.DATEONLY,
allowNull: false,
},
});
}

async down(queryInterface: QueryInterface) {
await queryInterface.dropTable('users');
}
}
