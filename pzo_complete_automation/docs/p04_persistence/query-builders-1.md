Query Builders in the Persistence Layer
======================================

In this document, we will delve into the topic of Query Builders within our Persistence Layer. Query Builders provide a high-level, fluent interface for constructing SQL queries, making database operations more readable and maintainable.

Introduction
------------

Query Builders are an essential part of the ORM (Object-Relational Mapping) frameworks and some database libraries. They enable developers to create complex SQL queries without needing to manually construct raw SQL strings. This section will cover the Query Builder classes used in our project's persistence layer, their functions, and examples for common usage scenarios.

### BaseQueryBuilder

The `BaseQueryBuilder` class is the foundation for all query builders in our persistence layer. It provides a fluent interface for constructing SQL queries using chained methods.

#### Creating a new instance

To create a new instance of a query builder, you should choose the appropriate subclass based on the type of query you want to execute (e.g., select, update, delete) and pass the required connection object. Here's an example:

```php
use App\Persistence\QueryBuilders;
use PDO;

$pdo = new PDO('mysql:host=localhost;dbname=my_database', 'username', 'password');
$queryBuilder = new QueryBuilders\Select($pdo);
```

#### Basic Query Operations

```php
$queryBuilder = new QueryBuilders\Select($pdo);
$queryBuilder->select('users.*')
->from('users')
->where('id', 1)
->orderBy('name ASC, email DESC')
->limit(10);
```

### Specific Query Builders

In addition to the `BaseQueryBuilder`, our persistence layer provides specific query builders for common operations like selecting, updating, and deleting records.

#### SelectQueryBuilder

The `SelectQueryBuilder` is used for fetching data from a database table. It extends the `BaseQueryBuilder` class with additional methods specifically designed for selecting records.

Example:

```php
$queryBuilder = new QueryBuilders\Select($pdo);
$results = $queryBuilder->select('users.*')
->from('users')
->where('id', 1)
->orderBy('name ASC, email DESC')
->limit(10)
->getResults();
```

#### UpdateQueryBuilder

The `UpdateQueryBuilder` is used for updating existing records in a database table. It also extends the `BaseQueryBuilder` class with methods tailored to updates.

Example:

```php
$queryBuilder = new QueryBuilders\Update($pdo);
$affectedRows = $queryBuilder->update('users')
->set('name', 'John Doe')
->where('id', 1)
->execute();
```

#### DeleteQueryBuilder

The `DeleteQueryBuilder` is used for deleting records from a database table. It extends the `BaseQueryBuilder` class with methods designed for deletions.

Example:

```php
$queryBuilder = new QueryBuilders\Delete($pdo);
$affectedRows = $queryBuilder->delete('users')
->where('id', 1)
->execute();
```

Conclusion
----------

In this documentation, we have explored the role of Query Builders in our persistence layer and covered the primary classes (`BaseQueryBuilder`, `SelectQueryBuilder`, `UpdateQueryBuilder`, and `DeleteQueryBuilder`) available for building SQL queries. By utilizing these query builders, you can simplify database operations while maintaining readability and ease of maintenance in your codebase.
