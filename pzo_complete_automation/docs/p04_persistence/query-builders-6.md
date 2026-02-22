Query Builders in Persistence Layer (v6)
======================================

Query builders are a powerful feature that abstracts the complex SQL queries, making it easier to write and maintain them within your application. In this document, we'll discuss how to use query builders in our persistence layer version 6.

### JDBC Query Builders

The JDBC query builder is used for constructing SQL queries using Java objects. It supports various methods to build complex queries with ease. Here are some examples:

#### Creating a simple SELECT query
```java
QueryBuilder qb = queryBuilderFactory.newQueryBuilder(SELECT, "user", null);
Query query = qb.query();
```

#### Using parameters in the query
```java
QueryBuilder qb = queryBuilderFactory.newQueryBuilder(SELECT, "user", null);
qb.where().eq("id", user_id);
Query query = qb.query();
```

#### Adding JOINs and subqueries
```java
QueryBuilder qb = queryBuilderFactory.newQueryBuilder(SELECT, "order", null);
qb.join("customer"); // performs a JOIN with the customer table
qb.where().subquery()
.select("id")
.from("customer")
.where().eq("id", user_id)
.endSubquery()
.eq("customer_id", subquery);
Query query = qb.query();
```

### Criteria Query Builders

Criteria query builders offer a more flexible and fluent way to construct complex queries in a type-safe manner. They are ideal for more advanced query needs.

#### Creating a simple SELECT query
```java
CriteriaBuilder cb = entityManager.getCriteriaBuilder();
CriteriaQuery<User> cq = cb.createQuery(User.class);
Root<User> root = cq.from(User.class);
cq.select(root);
TypedQuery<User> query = entityManager.createQuery(cq);
```

#### Using parameters in the query
```java
CriteriaBuilder cb = entityManager.getCriteriaBuilder();
CriteriaQuery<User> cq = cb.createQuery(User.class);
Root<User> root = cq.from(User.class);
cq.select(root)
.where(cb.equal(root.get("id"), user_id));
TypedQuery<User> query = entityManager.createQuery(cq);
```

#### Adding JOINs, subqueries and sorting
```java
CriteriaBuilder cb = entityManager.getCriteriaBuilder();
CriteriaQuery<Order> cq = cb.createQuery(Order.class);
Root<Order> root = cq.from(Order.class);
Join<Order, Customer> join = root.join("customer"); // performs a JOIN with the customer table
cq.select(root)
.where(cb.equal(join.get("id"), user_id))
.orderBy(cb.asc(root.get("name")));
TypedQuery<Order> query = entityManager.createQuery(cq);
```
