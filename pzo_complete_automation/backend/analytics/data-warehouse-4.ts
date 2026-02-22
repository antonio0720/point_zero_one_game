import { Pool } from 'pg';
import config from '../config';

const pool = new Pool(config.db);

export async function createDataWarehouse() {
await pool.connect((err, client) => {
if (err) throw err;

const sql = `
CREATE SCHEMA IF NOT EXISTS analytics;

-- Dimension Tables
CREATE TABLE analytics.customer (
customer_id SERIAL PRIMARY KEY,
first_name VARCHAR(255),
last_name VARCHAR(255),
email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE analytics.product (
product_id SERIAL PRIMARY KEY,
name VARCHAR(255) NOT NULL,
category VARCHAR(255) NOT NULL
);

-- Fact Table
CREATE TABLE analytics.sales_fact (
sale_id SERIAL PRIMARY KEY,
customer_id INTEGER REFERENCES analytics.customer(customer_id),
product_id INTEGER REFERENCES analytics.product(product_id),
quantity INTEGER NOT NULL,
total_price DECIMAL(10,2) NOT NULL,
sale_date TIMESTAMP NOT NULL
);
`;

client.query(sql);
client.release();
});
}

export async function insertCustomer(firstName: string, lastName: string, email: string) {
await pool.connect((err, client) => {
if (err) throw err;

const sql = 'INSERT INTO analytics.customer(first_name, last_name, email) VALUES($1, $2, $3)';
const values = [firstName, lastName, email];

client.query(sql, values);
client.release();
});
}

export async function insertProduct(name: string, category: string) {
await pool.connect((err, client) => {
if (err) throw err;

const sql = 'INSERT INTO analytics.product(name, category) VALUES($1, $2)';
const values = [name, category];

client.query(sql, values);
client.release();
});
}

export async function insertSale(customerId: number, productId: number, quantity: number, totalPrice: number, saleDate: Date) {
await pool.connect((err, client) => {
if (err) throw err;

const sql = 'INSERT INTO analytics.sales_fact(customer_id, product_id, quantity, total_price, sale_date) VALUES($1, $2, $3, $4, $5)';
const values = [customerId, productId, quantity, totalPrice, saleDate];

client.query(sql, values);
client.release();
});
}
