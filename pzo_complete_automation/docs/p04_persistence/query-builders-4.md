Query Builders in the Persistence Layer (Version 4)
===================================================

Overview
--------

Query builders are a fundamental part of the persistence layer, providing a convenient and type-safe way to construct SQL queries without directly writing raw SQL strings. This document outlines the latest version (v4) of our query builder system.

### Features

* Type-safe construction of SQL queries using fluent interfaces.
* Support for constructing both SELECT and UPDATE statements, as well as INSERT and DELETE operations.
* Parametrized query values to avoid SQL injection vulnerabilities.
* Support for JOINing multiple tables.
* Customizable aliasing of table and column names.
* Chaining of multiple query builders for complex queries.
* Support for raw SQL expressions within queries.
* Easy integration with various database dialects (MySQL, PostgreSQL, etc.).

### Usage

To use the query builder in your application, first ensure that you have imported the necessary classes:

```kotlin
import com.example.persistence.query.builder.*
import com.example.persistence.entity.User
```

Next, create a new instance of the QueryBuilder class and begin constructing your query:

```kotlin
val qb = QueryBuilder(User::class)
```

#### SELECT Queries

To construct a SELECT query, call the `select()` method followed by the column names you wish to retrieve:

```kotlin
qb.select("id", "username", "email")
```

You can also specify conditions on the selected columns using the `where()` method and providing a lambda expression that returns a Boolean value:

```kotlin
qb.where { user -> user.id == 1 }
```

#### UPDATE Queries

To update an existing record, use the `update()` method followed by a list of column-value pairs to be updated:

```kotlin
qb.update(mapOf("username" to "new_username", "email" to "new_email"))
```

You can also specify conditions for the update using the `where()` method as before.

#### INSERT Queries

To insert a new record, use the `insert()` method followed by a list of column-value pairs:

```kotlin
qb.insert(mapOf("username" to "new_user", "email" to "new_email"))
```

#### DELETE Queries

To delete an existing record, use the `delete()` method followed by a condition specifying which records should be deleted:

```kotlin
qb.where { user -> user.id == 1 }.delete()
```

#### JOIN Queries

To join multiple tables in your query, use the `join()` method on the QueryBuilder instance and specify the table alias and join condition:

```kotlin
val qb2 = QueryBuilder(Friend::class)
qb.join("friends", qb2) { user, friend -> user.id == friend.userId }
```

#### Raw SQL Expressions

In some cases, you may need to include raw SQL expressions within your queries. To do this, use the `raw()` method:

```kotlin
qb.where(RawSql("username LIKE '%${value}%'"))
```

#### Executing Queries

Once you have constructed your query, call the `build()` method to obtain a Query object, which can then be executed using an appropriate database connection:

```kotlin
val query = qb.build()
val resultSet = databaseConnection.executeQuery(query)
```

#### Chaining Query Builders

To create complex queries by chaining multiple QueryBuilder instances, simply call the `andAlso()` method on one instance and pass in another QueryBuilder:

```kotlin
val qb1 = QueryBuilder(User::class)
val qb2 = QueryBuilder(Friend::class)
qb1.join("friends", qb2).andAlso { user, friend -> user.id == friend.userId && friend.isActive }
```

In this example, the first query builder constructs a JOIN between the `User` and `Friend` tables, while the second query builder filters the results further by only including active friends.
