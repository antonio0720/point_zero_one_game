# Persistence Layer - Query Builders (v8)

The v8 version of the persistence layer introduces several enhancements to the Query Builder, aimed at providing more flexibility and efficiency in constructing database queries.

## Supported Database Systems

- MySQL
- PostgreSQL
- SQLite
- Microsoft SQL Server

## Basic Query Building

The core functionality of the v8 Query Builder remains similar to previous versions. You can create a new query instance for a specific table, and then chain various methods together to build your query. Here's an example:

```javascript
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize({ /* configuration options */ });

const query = sequelize.query(`SELECT * FROM users`, { type: QueryTypes.SELECT });
```

## Advanced Query Building

### Using Parameters

For safer and more efficient query construction, the v8 Query Builder supports parameterized queries.

```javascript
const query = sequelize.query('SELECT * FROM users WHERE id = :id', { replacements: { id: 1 }, type: QueryTypes.SELECT });
```

### Joins

The v8 Query Builder offers improved support for SQL joins, with methods for `INNER JOIN`, `LEFT JOIN`, and custom join types such as `RIGHT OUTER JOIN` or `CROSS JOIN`.

```javascript
const query = sequelize.query(`
SELECT * FROM users
INNER JOIN roles ON users.role_id = roles.id;
`, { type: QueryTypes.SELECT });
```

### Raw Queries with Parameters

You can also execute raw SQL queries that include parameters, which can be useful for more complex or customized queries.

```javascript
const query = sequelize.query(`
SELECT * FROM users
WHERE id IN (:ids);
`, { replacements: { ids: [1, 2, 3] }, type: QueryTypes.SELECT });
```

### Bulk Create and Update

The v8 Query Builder includes methods for bulk creating and updating records in a more efficient manner, which can be particularly useful for large datasets.

```javascript
const users = [
{ name: 'John Doe', email: 'john@example.com' },
{ name: 'Jane Smith', email: 'jane@example.com' }
];

sequelize.bulkCreate(users)
.then((createdUsers) => {
// handle createdUsers here
});
```

### Transaction Support

The v8 Query Builder supports database transactions, ensuring that a series of operations are either all committed or rolled back if any error occurs.

```javascript
sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE })
.then((t) => {
return User.create({ name: 'New User' }, { transaction: t });
})
.then(() => t.commit())
.catch((error) => t.rollback())
.finally(() => sequelize.close());
```
