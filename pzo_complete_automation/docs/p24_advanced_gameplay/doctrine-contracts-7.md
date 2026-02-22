# Doctrine Contracts 7

## Introduction

Doctrine Contracts is a PHP library that defines common interfaces for database entities and their mappings, enabling type safety and static code analysis for Entity-Relationship Mapping (ORM) in PHP projects. This version, **v7**, brings new features and improvements to the library.

## New Features

### Doctrine\Contracts\UnitOfWork\UnitOfWorkInterface

The UnitOfWorkInterface provides a contract for managing changes in entity state within a single transaction. It allows developers to work with entities without persisting them immediately, allowing for change tracking and batching of updates for improved performance.

#### Methods

- `commit()`: Persists all changed entities and flushes the EntityManager.
- `rollback()`: Rolls back the current transaction, discarding any changes made to entities.
- `refresh(Entity $entity)`: Refreshes the state of an entity with data from the database, overriding any local changes.
- `detach($entity)`: Detaches an entity from the unit of work, preventing it from being managed or tracked for changes.
- `isDirty(Entity $entity)`: Checks if an entity has been modified since it was last persisted.
- `isNew(Entity $entity)`: Checks if an entity is new and hasn't yet been persisted to the database.

### Doctrine\Contracts\EventDispatcher\EventDispatcherInterface

The EventDispatcherInterface defines a contract for dispatching events in PHP projects. It allows developers to easily plug into the event system and react to various events emitted by other parts of the application.

#### Methods

- `dispatch($event)`: Dispatches an event, allowing listeners registered on the event dispatcher to handle it.
- `addListener(string $eventName, callable $listener)`: Adds a new listener for the given event name and callback function.
- `removeListener(string $eventName, callable $listener)`: Removes an existing listener for the given event name and callback function.
- `hasListeners(string $eventName)`: Checks if there are any listeners registered for the given event name.

## Compatibility

Doctrine Contracts 7 is compatible with PHP 8.0+, Symfony 5.4+, and Doctrine ORM 2.6+. For projects using older versions of these dependencies, consider upgrading to take advantage of the new features and improvements provided by this release.

## Installation

To install Doctrine Contracts, use Composer:

```bash
composer require doctrine/doctrine-contracts
```

## Documentation

For more information about using Doctrine Contracts in your PHP projects, refer to the official [Doctrine Contracts documentation](https://www.doctrine-project.org/projects/doctrine-contracts/en/latest/).

## Contributing

Contributions are welcome! If you encounter any issues or have suggestions for improvements, please open an issue on the [Doctrine Contracts GitHub repository](https://github.com/doctrine/doctrine-contracts/issues). Pull requests are also appreciated.
