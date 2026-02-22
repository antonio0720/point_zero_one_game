# Persistence Layer - Query Builders (v3)

## Overview

This document outlines the v3 implementation of the Query Builder system within the persistence layer of our application. The aim is to provide a concise and comprehensive guide on how to leverage this powerful tool for constructing database queries in an efficient manner.

## Introduction

The Query Builder is a fundamental component of the persistence layer, allowing developers to compose complex SQL queries with ease by chaining methods together. Version 3 introduces several enhancements and improvements aimed at simplifying query construction and optimizing performance.

### Key Features

- **Chainable Methods**: The Query Builder allows for fluent method chaining, making it easy to construct complex queries in a concise manner.
- **SQL Injection Prevention**: By utilizing prepared statements under the hood, this system effectively prevents SQL injection attacks.
- **Performance Optimization**: The Query Builder has been optimized to generate efficient SQL queries that minimize resource usage.

## Usage

To utilize the Query Builder, you'll first need to obtain an instance of the `QueryBuilder` class from your chosen database connection:

```php
$db = new DatabaseConnection();
$queryBuilder = $db->getQueryBuilder();
```

### Basic Queries

The simplest form of query construction involves selecting data from a single table. Here's an example of how to execute a basic `SELECT` query:

```php
$results = $queryBuilder
->select('*')
->from('users')
->execute();
```

#### Selecting Specific Columns

To select specific columns, simply pass the desired column names as arguments to the `select()` method:

```php
$results = $queryBuilder
->select(['id', 'username'])
->from('users')
->execute();
```

#### Ordering Results

To order the results, utilize the `orderBy()` method and specify the column by which you want to sort:

```php
$results = $queryBuilder
->select('*')
->from('users')
->orderBy('username', 'ASC')
->execute();
```

### Conditional Queries

Conditional queries allow for filtering results based on specific conditions. The `where()` method is used to define these conditions, and the `andWhere()` and `orWhere()` methods can be chained to add additional conditions:

```php
$results = $queryBuilder
->select('*')
->from('users')
->where('id = ?', 1)
->andWhere('username = ?', 'johndoe')
->execute();
```

#### Using Parameters

The Query Builder automatically handles preparing and binding parameters to prevent SQL injection attacks. Whenever a parameter is used in the query, it should be passed as an argument to the method that uses it.

```php
$results = $queryBuilder
->select('*')
->from('users')
->where('id = ?', 1)
->andWhere('username = ?', 'johndoe')
->execute();
```

### Joins and Relationships

The Query Builder supports various types of joins to enable the retrieval of data from related tables. Here's an example of a basic `INNER JOIN`:

```php
$results = $queryBuilder
->select('u.id, u.username, p.password')
->from('users', 'u')
->innerJoin('user_profiles', 'p', 'u.id = p.user_id')
->execute();
```

#### Using Aliases

When joining tables, you can assign aliases to table names for easier referencing:

```php
$results = $queryBuilder
->select('u.id, u.username, p.password')
->from('users', 'u')
->innerJoin('user_profiles as p', 'u.id = p.user_id')
->execute();
```

### Advanced Queries

#### Grouping and Aggregating Data

To group and aggregate data, utilize the `groupBy()` method for grouping and the appropriate aggregation function (e.g., `count()`, `sum()`, etc.) to perform calculations:

```php
$results = $queryBuilder
->select('COUNT(*)')
->from('users')
->groupBy('country')
->execute();
```

#### Limiting Results

To limit the number of results returned, use the `setMaxResults()` method:

```php
$results = $queryBuilder
->select('*')
->from('users')
->setMaxResults(10)
->execute();
```

#### Offset Results

To skip a specific number of results, use the `setFirstResult()` method:

```php
$results = $queryBuilder
->select('*')
->from('users')
->setMaxResults(10)
->setFirstResult(20) // Skip the first 20 results
->execute();
```

## Conclusion

The Query Builder is a versatile and powerful tool within the persistence layer, making it easy to construct complex database queries while ensuring SQL injection prevention and performance optimization. By mastering its usage, developers can more efficiently interact with your application's data storage system.
