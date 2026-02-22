Query Builders in the Persistence Layer (v5)
=============================================

The persistence layer of version 5 introduces an advanced Query Builder system, enabling more complex and flexible data retrieval operations. This document provides a comprehensive overview of the query builders' features and usage.

### Basic Query Building

A new `QueryBuilder` interface has been introduced for constructing database queries in a fluent and type-safe manner.

```php
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

// ...

$queryBuilder = $entityManager->createQueryBuilder();
$usersQuery = $queryBuilder
->select('u')
->from(User::class, 'u');
```

### Filtering Results

The `where()`, `andWhere()`, and `orWhere()` methods can be used to filter the results based on specific conditions.

```php
$usersQuery->where('u.id = :userId')
->setParameter('userId', $someUserId);
```

### Ordering Results

The `orderBy()` method allows you to sort the query's results in ascending or descending order.

```php
$usersQuery->orderBy('u.name', 'ASC');
```

### Limiting and Offsetting Results

The `setMaxResults()` method sets a limit on the number of returned results, while the `setFirstResult()` method is used for pagination purposes.

```php
$usersQuery->setMaxResults(10)
->setFirstResult(20);
```

### Aliases and Joined Entities

Aliases can be assigned to entities involved in the query using the `as()` method. This makes it possible to join additional entities and refer to them by their aliases.

```php
$queryBuilder->select('u')
->from(User::class, 'u')
->join('u.posts', 'p')
->where('p.title = :postTitle');
```

### Dynamic SQL and Custom Expressions

The `expr()` function can be used to create custom expressions or dynamic SQL within the query builder.

```php
use Doctrine\ORM\Query\Expr\Andx;
use Doctrine\ORM\Query\Expr\Func;

$queryBuilder->select(Funccall::concat([
'u.name', Func::concat(' ', 'p.title')
]))
->from(User::class, 'u')
->join('u.posts', 'p')
->where($queryBuilder->expr()->orX(
$queryBuilder->expr()->like('u.name', ':userName'),
$queryBuilder->expr()->like('p.title', ':postTitle')
));
```

### Using Native SQL Queries

In some cases, it might be necessary to execute native SQL queries instead of DQL (Doctrine Query Language). This can be done using the `getConnection()` method on the EntityManagerInterface.

```php
use Doctrine\DBAL\Connection;

$connection = $entityManager->getConnection();
$sql = 'SELECT * FROM users WHERE id = :userId';
$stmt = $connection->prepare($sql);
$stmt->execute(['userId' => $someUserId]);
```

### Executing Queries and Fetching Results

Once the query has been built, it can be executed using the `getQuery()` method on the QueryBuilder instance. The results can then be fetched as an array or an associative array.

```php
$users = $usersQuery->getQuery()->getResult();
// or
$users = $usersQuery->getQuery()->getArrayResult();
```

### Counting Results and Aggregates

To count the number of matching rows without fetching all data, you can use the `select()` method with the `COUNT()` function.

```php
$userCount = $queryBuilder->select('COUNT(u)')
->from(User::class, 'u')
->getQuery()->getSingleScalarResult();
```

### Using Query Builders in Repositories

In the provided repository interfaces, methods for executing queries have been implemented as a convenient way to interact with the persistence layer. These methods use the QueryBuilder internally and offer an easy-to-use interface for common database operations.

```php
use App\Repository\UserRepository;

// ...

$userRepository->findAll(); // Fetches all users
$userRepository->findById($someUserId); // Fetches a user by id
$userRepository->countUsersByName('John'); // Counts users with the name 'John'
```

### Advanced Usage and Customizations

For more advanced usage scenarios or customizations, you can directly manipulate the generated SQL using APPEND_SQL, NATIVE_SQL, and custom DQL functions in your repository classes. Refer to the Doctrine documentation for further details on these features: [Doctrine Documentation - Advanced Querying](https://www.doctrine-project.org/projects/orm/docs/latest/reference/dql-doctrine-query-language)
