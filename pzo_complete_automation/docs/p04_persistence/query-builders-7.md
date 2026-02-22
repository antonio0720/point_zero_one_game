Query Builders in Persistence Layer (v7)
=======================================

Query builders are a powerful feature of the persistence layer that allow for the construction of SQL queries dynamically in an object-oriented fashion. This guide will explain the usage and features of query builders in version 7 of our persistence layer.

Table of Contents
------------------

1. [Basic Query Builder Usage](#basic-query-builder-usage)
1.1. [Simple Queries](#simple-queries)
1.2. [Complex Queries](#complex-queries)
2. [Query Parameters and Binding](#query-parameters-and-binding)
3. [Aliases, Joins, and Aggregations](#aliases-joins-and-aggregations)
4. [Ordering and Pagination](#ordering-and-pagination)
5. [Named Queries](#named-queries)
6. [Native SQL Queries](#native-sql-queries)
7. [Advanced Topics](#advanced-topics)
7.1. [Query Caching](#query-caching)
7.2. [Lazy Loading and Proxies](#lazy-loading-and-proxies)

Basic Query Builder Usage
--------------------------

### Simple Queries

To create a simple query, instantiate the `QueryBuilder` class for your entity with an entity manager:

```php
$query = $entityManager->createQueryBuilder('User');
```

Then, call the `select()`, `from()`, and other methods on the `QueryBuilder` object to build a query. For example, to select all users from the database:

```php
$query = $entityManager->createQueryBuilder('User')
->select('u');

// Execute the query and fetch results as an array of objects
$results = $query->getQuery()->getResult();
```

### Complex Queries

Complex queries can be built using the `join()`, `innerJoin()`, `leftJoin()`, and other methods to relate entities. For example, to select all user orders:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->select('u, o')
->join('u.orders', 'o');

// Execute the query and fetch results as an array of objects
$results = $query->getQuery()->getResult();
```

Query Parameters and Binding
----------------------------

Parameters can be bound to queries using the `setParameter()`, `addParameter()`, and other methods. These methods allow you to specify a name for the parameter, which will then be replaced in the query with the actual value:

```php
$query = $entityManager->createQueryBuilder('User')
->select('u')
->where('u.id = :userId');

// Bind the value to the named parameter
$query->setParameter('userId', 123);

// Execute the query and fetch results as an array of objects
$results = $query->getQuery()->getResult();
```

Aliases, Joins, and Aggregations
-------------------------------

Aliases can be assigned to entities using the `as()` method. Aliases are useful when working with multiple entities in a single query:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->select('u, o as order')
->join('u.orders', 'o');
```

Joins can be performed using the `innerJoin()`, `leftJoin()`, and other methods to relate entities in a query:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->select('u, o as order')
->join('u.orders', 'o');
```

Aggregations can be performed using the `sum()`, `avg()`, `min()`, and other methods:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->select('AVG(u.age) as average_age');
```

Ordering and Pagination
-----------------------

Results can be ordered using the `orderBy()` method:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->orderBy('u.name', 'ASC');
```

Pagination can be implemented by setting a limit on the number of results returned and an offset to skip a certain number of results:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->setMaxResults(10)
->setFirstResult(20);
```

Named Queries
--------------

Named queries allow you to define reusable queries that can be executed using the `$entityManager->createQuery()` method:

```php
// Define a named query for finding all users with admin roles
$entityManager->getRepository('App\Entity\User')
->createQueryBuilder('u')
->where('u.roles = :adminRole')
->setParameter('adminRole', 'ROLE_ADMIN')
->setMaxResults(10)
->setFirstResult(20)
->setQuerySpacing(QuerySpacing::EXPRESSION)
->setCacheable(true)
->orderBy('u.name', 'ASC')
->setName('find_admin_users');

// Execute the named query
$query = $entityManager->createQuery('App\Entity\User:find_admin_users');
```

Native SQL Queries
-------------------

Native SQL queries can be executed using the `executeQuery()` method and passing raw SQL as a string:

```php
// Execute a native SQL query
$results = $entityManager->getConnection()->executeQuery(
'SELECT * FROM user WHERE id = :id',
['id' => 123]
);
```

Advanced Topics
---------------

### Query Caching

Query caching can be enabled to improve performance by storing query results in the cache:

```php
$query = $entityManager->createQueryBuilder('User', 'u')
->setCacheable(true)
// ... (other query configuration)
```

### Lazy Loading and Proxies

Lazy loading can be enabled to delay the loading of associated entities until they are actually needed:

```php
$user = $entityManager->find('App\Entity\User', 123);
// The user's orders will not be loaded immediately
echo $user->getName(); // "John Doe"
echo $user->getOrders(); // null

// Load the user's orders when needed
foreach ($user->getOrders() as $order) {
echo $order->getTotal();
}
```

In some cases, you may need to disable lazy loading for specific associations using the `fetch()` method:

```php
$user = $entityManager->find('App\Entity\User', 123);
// Load the user's orders immediately
$user->setOrders($user->getOrders()->fetch());
```
