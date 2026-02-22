Query Builders in Persistence Layer (v9)
======================================

Query builders are a powerful feature of the persistence layer, providing an easy and flexible way to construct database queries without writing raw SQL. This document describes the query builder features in version 9 of our persistence library.

Table of Contents
------------------

1. [Basic Query Building](#basic-query-building)
1.1. [Selecting Data](#selecting-data)
1.2. [Filtering Results](#filtering-results)
1.3. [Sorting Results](#sorting-results)
1.4. [Limiting and Offsetting Results](#limiting-and-offsetting-results)
1.5. [Joining Tables](#joining-tables)
2. [Advanced Query Building](#advanced-query-building)
2.1. [Subqueries](#subqueries)
2.2. [Dynamic Queries](#dynamic-queries)
2.3. [Native SQL](#native-sql)

<a name="basic-query-building"></a>
## Basic Query Building

### Selecting Data

To select data from a table, use the `select` method followed by the columns you want to retrieve:

```php
$builder = $entityManager->createQueryBuilder();
$query = $builder
->select('u.id, u.name')
->from('User', 'u')
->getQuery();
```

### Filtering Results

Filter the results using the `where` method followed by the condition:

```php
$builder = $entityManager->createQueryBuilder();
$query = $builder
->select('u.id, u.name')
->from('User', 'u')
->where('u.id = :userId')
->setParameter('userId', 123)
->getQuery();
```

### Sorting Results

Sort the results using the `orderBy` method:

```php
$builder = $entityManager->createQueryBuilder();
$query = $builder
->select('u.id, u.name')
->from('User', 'u')
->where('u.id = :userId')
->setParameter('userId', 123)
->orderBy('u.name', 'ASC')
->getQuery();
```

### Limiting and Offsetting Results

Limit and offset the results using the `setMaxResults` and `setFirstResult` methods:

```php
$builder = $entityManager->createQueryBuilder();
$query = $builder
->select('u.id, u.name')
->from('User', 'u')
->where('u.id = :userId')
->setParameter('userId', 123)
->orderBy('u.name', 'ASC')
->setMaxResults(10)
->setFirstResult(20)
->getQuery();
```

### Joining Tables

Join tables using the `join`, `innerJoin`, `leftJoin`, or `rightJoin` methods:

```php
$builder = $entityManager->createQueryBuilder();
$query = $builder
->select('u.id, u.name, a.id as addressId, a.street')
->from('User', 'u')
->innerJoin('u.address', 'a')
->where('u.id = :userId')
->setParameter('userId', 123)
->getQuery();
```

<a name="advanced-query-building"></a>
## Advanced Query Building

### Subqueries

Use subqueries to include complex conditions in your queries:

```php
$builder = $entityManager->createQueryBuilder();
$subquery = $builder
->select('a.id')
->from('Address', 'a')
->where('a.city = :city');
$query = $builder
->select('u.id, u.name')
->from('User', 'u')
->where($builder->expr()->in('u.addressId', $subquery))
->setParameter('city', 'New York')
->getQuery();
```

### Dynamic Queries

Create dynamic queries using expressions:

```php
$builder = $entityManager->createQueryBuilder();
$columnName = 'username';
$value = 'john_doe';
$query = $builder
->select('u.id')
->from('User', 'u')
->where($builder->expr()->eq('u.' . $columnName, ':user'))
->setParameter('user', $value)
->getQuery();
```

### Native SQL

Use native SQL for more control over the query:

```php
$builder = $entityManager->createQueryBuilder();
$query = $builder
->select('u.id')
->from('User', 'u')
->setSQL('SELECT u.id FROM user u WHERE u.name LIKE :name')
->setParameter('name', '%john%')
->getQuery();
```
