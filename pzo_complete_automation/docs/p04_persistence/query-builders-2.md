Query Builders (v2) in the Persistence Layer
=============================================

Overview
--------

The Query Builder v2 is an advanced, flexible, and extensible tool for building SQL queries in a more readable and type-safe manner. It provides a fluent API that allows you to construct complex queries using method chaining, reducing the likelihood of syntax errors and making your code easier to maintain.

Key Features
------------

1. Type Safety: The Query Builder uses static typing to ensure that each method call is valid within the context of the current query state, helping prevent common SQL injection vulnerabilities.
2. Readability: By separating SQL logic from application logic, your code becomes more organized and easier to understand.
3. Method Chaining: You can chain multiple method calls together to create complex queries in a concise and easy-to-read manner.
4. Extensibility: It is possible to extend the Query Builder by adding custom functions or methods for specific use cases.
5. Lazy Evaluation: Queries are not executed until the `getResult()` method is called, allowing you to construct complex queries incrementally and optimize performance.

Basic Usage
-----------

Let's create a simple Query Builder instance and execute a basic SELECT query using the following example:

```php
use MyProject\Persistence\QueryBuilder;
use MyProject\Entity\User;

$query = new QueryBuilder(new EntityManager());
$result = $query
->select(User::class)
->from('users')
->where('id = :id')
->setParameter(':id', 1)
->getResult();
```

In this example, we are using the Query Builder to construct a SELECT query that fetches a single `User` entity from the 'users' table where the `id` column equals 1. The resulting data is stored in the `$result` variable.

Advanced Usage
--------------

The Query Builder offers a wide range of features for building more complex queries, such as:

- Joining multiple tables using `join`, `leftJoin`, and `rightJoin` methods.
- Using subqueries with the `subQuery` method.
- Sorting results using the `orderBy` method.
- Grouping results using the `groupBy` method.
- Limiting and offsetting results using the `limit` and `offset` methods.
- Custom SQL snippets using the `raw` method.
- Building dynamic queries using parameter placeholders and the `setParameter` method.

It's important to note that advanced usage may require a deeper understanding of SQL syntax, but the Query Builder's type-safe API will help you avoid common mistakes and improve your overall code quality.

Conclusion
----------

The Query Builder v2 offers a powerful and flexible way to construct SQL queries in a more readable and type-safe manner, reducing the likelihood of syntax errors and improving the maintainability of your code. By leveraging its various features, you can create complex queries with ease while ensuring that your data is secure and optimized for performance.

For further information, consult the official documentation or reach out to our support team if you encounter any issues or have specific questions regarding the Query Builder's usage.
