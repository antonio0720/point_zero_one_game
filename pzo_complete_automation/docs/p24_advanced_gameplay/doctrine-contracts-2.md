Advanced Gameplay - Doctrine Contracts 2
=========================================

**Doctrine Contracts 2** is an extension for the popular Object-Relational Mapping (ORM) library for PHP, Doctrine ORM. It provides a set of interfaces and base classes to ease the development of complex database applications by implementing common patterns and best practices.

This document covers the advanced usage of Doctrine Contracts 2 in game development.

Table of Contents
------------------

1. [Introduction](#introduction)
2. [Entity Lifecycle Callbacks](#entity-lifecycle-callbacks)
* 2.1 [OnCreate](#oncreate)
* 2.2 [OnUpdate](#onupdate)
* 2.3 [OnPrePersist](#onprepersist)
* 2.4 [OnPreUpdate](#onpreupdate)
* 2.5 [OnPostLoad](#onpostload)
* 2.6 [OnPreRemove](#onpreremove)
3. [Auditing and Versioning](#auditing-and-versioning)
* 3.1 [Creating Audit Entities](#creating-audit-entities)
* 3.2 [Using Audit Entities](#using-audit-entities)
4. [Soft Deletes](#soft-deletes)
* 4.1 [Implementing Soft Deletes](#implementing-soft-deletes)
* 4.2 [Querying Soft Deleted Entities](#querying-soft-deleted-entities)
5. [Event Subscribers and Listening to Doctrine Events](#event-subscribers-and-listening-to-doctrine-events)
6. [Conclusion](#conclusion)

<a name="introduction"></a>
## 1. Introduction

Doctrine Contracts 2 provides a set of interfaces and base classes to ease the development of complex database applications by implementing common patterns and best practices. This document focuses on the advanced usage of Doctrine Contracts 2 in game development, covering topics such as Entity Lifecycle Callbacks, Auditing and Versioning, Soft Deletes, and Event Subscribers.

<a name="entity-lifecycle-callbacks"></a>
## 2. Entity Lifecycle Callbacks

Doctrine Contracts 2 allows you to define callback methods on your entities that get called during the entity lifecycle events such as creating, updating, loading, and removing.

### 2.1 OnCreate

The `OnCreate` method gets called when an entity is inserted into the database.
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onCreate"})
*/
class GameCharacter
{
/**
* @ORM\Id()
* @ORM\GeneratedValue()
* @ORM\Column(type="integer")
*/
private $id;

/**
* @ORM\Column(type="string")
*/
private $name;

/**
* @ORM\OneToMany(targetEntity=GameItem::class, mappedBy="character", orphanRemoval=true)
*/
private $items;

public function onCreate()
{
// Initialize default values for the entity when it's created
$this->items = new ArrayCollection();
}
}
```

### 2.2 OnUpdate

The `OnUpdate` method gets called when an existing entity is updated in the database.
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onUpdate"})
*/
class GameCharacter
{
// ... (same as before)

public function onUpdate()
{
// Update some values when the entity is updated
}
}
```

### 2.3 OnPrePersist

The `OnPrePersist` method gets called just before an entity is persisted (inserted or updated). This can be useful for setting timestamps or performing calculations that should happen before the entity is saved.
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onPrePersist"})
*/
class GameCharacter
{
/**
* @ORM\Column(type="datetime")
*/
private $createdAt;

/**
* @ORM\Column(type="datetime", nullable=true)
*/
private $updatedAt;

public function onPrePersist()
{
if (null === $this->createdAt) {
$this->createdAt = new \DateTimeImmutable();
}
$this->updatedAt = new \DateTimeImmutable();
}
}
```

### 2.4 OnPreUpdate

The `OnPreUpdate` method gets called just before an existing entity is updated. This can be useful for setting timestamps or performing calculations that should happen before the entity is saved.
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onPreUpdate"})
*/
class GameCharacter
{
/**
* @ORM\Column(type="datetime")
*/
private $updatedAt;

public function onPreUpdate()
{
$this->updatedAt = new \DateTimeImmutable();
}
}
```

### 2.5 OnPostLoad

The `OnPostLoad` method gets called after an entity is loaded from the database. This can be useful for initializing related entities or performing calculations based on the data that was fetched from the database.
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onPostLoad"})
*/
class GameCharacter
{
/**
* @ORM\OneToMany(targetEntity=GameItem::class, mappedBy="character")
*/
private $items;

public function onPostLoad()
{
// Load related entities or perform calculations based on the data that was fetched from the database
}
}
```

### 2.6 OnPreRemove

The `OnPreRemove` method gets called just before an entity is removed from the database. This can be useful for performing actions such as moving the entity to a soft-deleted state or triggering events that should happen before the entity is deleted.
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onPreRemove"})
*/
class GameCharacter
{
/**
* @ORM\OneToMany(targetEntity=GameItem::class, mappedBy="character", orphanRemoval=true)
*/
private $items;

public function onPreRemove()
{
// Move the entity to a soft-deleted state or trigger events before the entity is deleted
}
}
```
<a name="auditing-and-versioning"></a>
## 3. Auditing and Versioning

Doctrine Contracts 2 provides interfaces for auditing and versioning your entities, making it easy to track changes and maintain data integrity.

### 3.1 Creating Audit Entities

First, you'll need to create an `Audit` entity that will contain the audit information for other entities:
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity
*/
class Audit
{
/**
* @ORM\Id()
* @ORM\GeneratedValue()
* @ORM\Column(type="integer")
*/
private $id;

/**
* @ORM\ManyToOne(targetEntity=User::class)
*/
private $user;

/**
* @ORM\ManyToOne(targetEntity=GameCharacter::class)
*/
private $character;

/**
* @ORM\Column(type="string")
*/
private $action;

/**
* @ORM\Column(type="datetime")
*/
private $timestamp;

// ... (additional fields as needed)
}
```

### 3.2 Using Audit Entities

Now that you have an `Audit` entity, you can use it to audit changes made to other entities:
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(lifecycleCallbacks={"onPrePersist", "onPreUpdate", "onPreRemove"})
*/
class GameCharacter implements Auditable, Versionable
{
/**
* @ORM\Id()
* @ORM\GeneratedValue()
* @ORM\Column(type="integer")
*/
private $id;

/**
* @ORM\ManyToOne(targetEntity=User::class)
*/
private $owner;

// ... (additional fields as needed)

public function onPrePersist()
{
parent::onPrePersist();

$audit = new Audit();
$audit->setUser($this->getOwner());
$audit->setCharacter($this);
$audit->setAction('created');
$audit->setTimestamp(new \DateTimeImmutable());
$this->entityManager->persist($audit);
}

public function onPreUpdate()
{
parent::onPreUpdate();

$audit = new Audit();
$audit->setUser($this->getOwner());
$audit->setCharacter($this);
$audit->setAction('updated');
$audit->setTimestamp(new \DateTimeImmutable());
$this->entityManager->persist($audit);
}

public function onPreRemove()
{
parent::onPreRemove();

$audit = new Audit();
$audit->setUser($this->getOwner());
$audit->setCharacter($this);
$audit->setAction('deleted');
$audit->setTimestamp(new \DateTimeImmutable());
$this->entityManager->persist($audit);
}
}
```
<a name="soft-deletes"></a>
## 4. Soft Deletes

Soft deletes allow you to mark an entity as deleted without physically removing it from the database. This can be useful for maintaining data integrity and making it easier to restore deleted entities if necessary.

### 4.1 Implementing Soft Deletes

To implement soft deletes, you'll need to add a deleted field to your entity and modify your repository methods accordingly:
```php
use Doctrine\ORM\Mapping as ORM;

/**
* @ORM\Entity(repositoryClass=SoftDeletableCharacterRepository::class)
*/
class GameCharacter implements SoftDeletable
{
/**
* @ORM\Id()
* @ORM\GeneratedValue()
* @ORM\Column(type="integer")
*/
private $id;

/**
* @ORM\Column(type="boolean")
*/
private $isDeleted = false;

// ... (additional fields as needed)

public function delete()
{
$this->isDeleted = true;
$this->entityManager->persist($this);
}
}
```

Now you'll need to create a custom repository for your `GameCharacter` entity:
```php
use Doctrine\ORM\EntityRepository;
use Doctrine\ORM\QueryBuilder;

class SoftDeletableCharacterRepository extends EntityRepository implements SoftDeletableRepository
{
public function findAll(): QueryBuilder
{
return $this->createQueryBuilder('g')
->where('g.isDeleted = :is_deleted')
->setParameter('is_deleted', false)
->orderBy('g.id', 'ASC');
}
}
```

### 4.2 Querying Soft Deleted Entities

To query soft deleted entities, you'll need to modify your repository methods to include the `isDeleted` field in your queries:
```php
class SoftDeletableCharacterRepository extends EntityRepository implements SoftDeletableRepository
{
public function findAll(): QueryBuilder
{
return $this->createQueryBuilder('g')
->where('g.isDeleted = :is_deleted OR g.isDeleted IS NULL')
->setParameter('is_deleted', false)
->orderBy('g.id', 'ASC');
}
}
```
<a name="event-subscribers-and-listening-to-doctrine-events"></a>
## 5. Event Subscribers and Listening to Doctrine Events

Doctrine Contracts 2 allows you to create event subscribers that listen to various events fired by the ORM. This can be useful for performing custom actions or logging during database operations.

### Creating an Event Subscriber

To create an event subscriber, you'll need to define a class that implements the `EventSubscriberInterface` and adds methods that correspond to the events you want to listen to:
```php
use Doctrine\ORM\Events;
use Doctrine\ORM\Event\LifecycleEventArgs;
use Doctrine\ORM\Event\PostPersistEventArgs;
use Doctrine\ORM\Event\PostUpdateEventArgs;
use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Event\PreRemoveEventArgs;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events as ORMEvents;
use Doctrine\ORM\Mapping\ClassMetadata;

class GameEventListener implements EventSubscriberInterface
{
public function getSubscribedEvents()
{
return [
ORMEvents::prePersist,
ORMEvents::postPersist,
ORMEvents::preUpdate,
ORMEvents::postUpdate,
ORMEvents::preRemove,
];
}

public function prePersist(PrePersistEventArgs $args)
{
// Perform actions when an entity is about to be persisted (inserted or updated)
}

public function postPersist(PostPersistEventArgs $args)
{
// Perform actions after an entity has been persisted (inserted or updated)
}

public function preUpdate(PreUpdateEventArgs $args)
{
// Perform actions when an existing entity is about to be updated
}

public function postUpdate(PostUpdateEventArgs $args)
{
// Perform actions after an existing entity has been updated
}

public function preRemove(PreRemoveEventArgs $args)
{
// Perform actions when an entity is about to be removed
}
}
```

### Registering the Event Subscriber

To register your event subscriber, you'll need to add it to the list of event listeners in your application:
```php
use Doctrine\ORM\Configuration;
use Doctrine\ORM\Event\Events;

$config = new Configuration();

// ... (other configuration)

$config->setEventListeners([
$config->getEventListeners()[Events::ON_PRE_PERSIST][] = new GameEventListener(),
$config->getEventListeners()[Events::ON_POST_PERSIST][] = new GameEventListener(),
$config->getEventListeners()[Events::ON_PRE_UPDATE][] = new GameEventListener(),
$config->getEventListeners()[Events::ON_POST_UPDATE][] = new GameEventListener(),
$config->getEventListeners()[Events::ON_PRE_REMOVE][] = new GameEventListener(),
]);
```
<a name="conclusion"></a>
## 6. Conclusion

Doctrine Contracts 2 provides a powerful set of tools for managing complex database applications, and the examples provided in this document demonstrate some of its advanced features that are particularly useful in game development. Whether you're working on a small project or a large-scale MMO, Doctrine Contracts 2 can help you build high-quality, scalable, and maintainable games.
