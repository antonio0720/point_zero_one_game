import { DataSource } from 'typeorm';
import { Connection, CreateConnectionOptions } from 'typeorm/config';

// Define your entity models here (e.g., User, Order, Product)
class User {
id: number;
name: string;
email: string;
}

class Order {
id: number;
userId: number;
orderDate: Date;
totalAmount: number;
}

// Create a TypeORM data source configuration object
const dataSourceOptions: CreateConnectionOptions = {
type: 'postgres',
host: process.env.DB_HOST,
port: parseInt(process.env.DB_PORT!),
username: process.env.DB_USERNAME,
password: process.env.DB_PASSWORD,
database: process.env.DB_DATABASE,
synchronize: false, // Set to true for development environment
logging: false, // Adjust logging levels based on your needs
entities: [User, Order],
};

// Initialize the TypeORM connection
let dataSource: Connection;

async function initializeDataSource() {
dataSource = await new DataSource(dataSourceOptions).initialize();
}

initializeDataSource().catch((error) => console.error(error));
