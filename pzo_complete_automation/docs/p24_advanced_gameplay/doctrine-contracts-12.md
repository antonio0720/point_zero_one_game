Advanced Gameplay with Doctrine Contracts 12
=============================================

Doctrine Contracts is a set of PHP interfaces that provide a common ground for different ORM implementations like Doctrine, Propel, and others to work together in a consistent way. This documentation will cover the advanced gameplay features available in Doctrine Contracts 12.

Table of Contents
-----------------

* [Introduction](#introduction)
* [Entity Identity and Equality](#entity-identity-and-equality)
* [Lifecycle Callbacks](#lifecycle-callbacks)
* [Change Tracking](#change-tracking)
* [Custom Repositories](#custom-repositories)
* [Event Dispatcher](#event-dispatcher)
* [Conclusion](#conclusion)

<a name="introduction"></a>

### Introduction

Doctrine Contracts 12 provides an easy way to extend and customize the behavior of your ORM, regardless of whether you're using Doctrine DBAL, Doctrine ORM, or another compatible ORM. This document will focus on the advanced features that make it easier to build complex applications with Doctrine.

<a name="entity-identity-and-equality"></a>

### Entity Identity and Equality

Doctrine Contracts 12 introduces the concept of entity identity, which helps manage object equality in a consistent way across different ORMs. By implementing the `IdentityInterface`, you can define your entities to have a stable identifier that remains constant even if other properties change.

```php
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Contracts\UnitOfWork\StableIdentity;

/** @ORM\Entity */
class User implements StableIdentity
{
/** @ORM\Id @ORM\GeneratedValue */
protected $id;

// Other properties...

public function getIdentity(): string
{
return (string) $this->id;
}
}
```

In addition to entity identity, Doctrine Contracts 12 also provides a way to define custom equality comparators for your entities. By implementing the `EqualityComparatorInterface`, you can control how entities are compared for equality during operations like merge and detach.

```php
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Contracts\UnitOfWork\EqualityComparator;

/** @ORM\Entity */
class User implements StableIdentity, EqualityComparator
{
// ...

public function isEqual(object $other): bool
{
if (!$other instanceof self) {
return false;
}

return $this->id === $other->getIdentity();
}
}
```

<a name="lifecycle-callbacks"></a>

### Lifecycle Callbacks

Doctrine Contracts 12 allows you to define lifecycle callbacks, which are methods that are called during the life of an entity instance. This can be useful for performing custom actions when an entity is loaded, saved, or deleted.

```php
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Contracts\ORM\UnitOfWorkAwareInterface;

/** @ORM\Entity */
class User implements UnitOfWorkAwareInterface
{
// ...

public function prePersist(UnitOfWorkInterface $unitOfWork): void
{
// Perform an action before the entity is persisted...
}

public function postLoad(UnitOfWorkInterface $unitOfWork): void
{
// Perform an action after the entity has been loaded...
}
}
```

<a name="change-tracking"></a>

### Change Tracking

Doctrine Contracts 12 provides a consistent interface for change tracking across different ORMs. By implementing the `ChangeTrackingInterface`, you can define methods that will be called when an entity property changes, allowing you to build powerful auditing and versioning solutions.

```php
use Doctrine\ORM\Mapping as ORM;
use Doctrine\Contracts\ChangeTracking\ChangeTrackerAwareInterface;

/** @ORM\Entity */
class User implements ChangeTrackerAwareInterface
{
// ...

public function preUpdate(array $oldValues, ChangeTrackerInterface $changeTracker): void
{
// Perform an action before the entity is updated...
}
}
```

<a name="custom-repositories"></a>

### Custom Repositories

Doctrine Contracts 12 allows you to create custom repositories that extend the built-in repository functionality. This can be useful for building custom query methods, event listeners, and other specialized features.

```php
use Doctrine\ORM\EntityRepository;
use Doctrine\Contracts\Persistence\ObjectManager;
use Doctrine\Contracts\Persistence\RepositoryInterface;

class CustomUserRepository extends EntityRepository implements RepositoryInterface
{
public function __construct(ObjectManager $em)
{
parent::__construct($em, User::class);
}

public function findByUsername(string $username): array
{
return $this->createQueryBuilder('u')
->where('u.username = :username')
->setParameter('username', $username)
->getQuery()
->getResult();
}
}
```

<a name="event-dispatcher"></a>

### Event Dispatcher

Doctrine Contracts 12 provides an event dispatcher that allows you to listen for and respond to events during the lifecycle of your entities. This can be useful for building custom validation, auditing, and security solutions.

```php
use Doctrine\ORM\Event\LifecycleEventArgs;
use Doctrine\Contracts\EventDispatcher\EventDispatcherInterface;

class CustomEventListener implements EventSubscriber
{
public static function getSubscribedEvents(): array
{
return [
prePersist: ['prePersist', 10],
postLoad: ['postLoad', 10],
];
}

public function prePersist(LifecycleEventArgs $args): void
{
// Perform an action before the entity is persisted...
}

public function postLoad(LifecycleEventArgs $args): void
{
// Perform an action after the entity has been loaded...
}
}
```

<a name="conclusion"></a>

### Conclusion

Doctrine Contracts 12 provides a powerful set of tools for building advanced gameplay features in your PHP applications. By implementing its interfaces and extending its classes, you can build custom ORM solutions that are consistent across different ORMs like Doctrine DBAL and Doctrine ORM. With the ability to define entity identity, lifecycle callbacks, change tracking, custom repositories, and event dispatchers, you'll have everything you need to create complex applications with ease.
