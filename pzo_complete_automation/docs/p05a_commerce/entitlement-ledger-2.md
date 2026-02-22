Entitlement Ledger 2
=====================

Overview
--------

The Entitlement Ledger 2 (EL2) is a component within the Commerce system that manages entitlements for customers. It provides a comprehensive record of all entitlement transactions, including purchases, redeeming rewards, and adjustments.

Architecture
-------------

### Components

1. Entitlement Ledger API: A RESTful API used to create, read, update, and delete entitlements for customers.
2. Entitlement Ledger Database: Stores all entitlement records, with fields for entitlement ID, customer ID, type of entitlement, quantity, start date, end date, and status.
3. Event Handlers: Process events from other components like the Shopping Cart, Rewards System, and Adjustments System to update the Entitlement Ledger accordingly.
4. Webhooks: Allow external systems to integrate with EL2, such as third-party rewards providers or loyalty programs.

Usage
-----

### API Endpoints

- **POST /entitlements**: Create a new entitlement for a customer. Requires the type of entitlement, quantity, and associated data (e.g., start/end dates).
- **GET /entitlements/{id}**: Retrieve the details of an entitlement by its ID.
- **PUT /entitlements/{id}**: Update an existing entitlement's details.
- **DELETE /entitlements/{id}**: Remove an entitlement from the ledger.

### Webhooks

EL2 offers several webhook events that can be subscribed to:

1. `entitlement_created`: Triggered when a new entitlement is created.
2. `entitlement_updated`: Triggered when an existing entitlement's details are updated.
3. `entitlement_deleted`: Triggered when an entitlement is removed from the ledger.

### Entitlement Statuses

- Active: The entitlement can be redeemed or used.
- Redeemed: The entitlement has been used and is no longer available for redemption.
- Expired: The entitlement has passed its expiration date and can no longer be used.
- Cancelled: An entitlement was manually cancelled by an administrator.

Security Considerations
------------------------

Access to the Entitlement Ledger API is restricted through OAuth 2.0, ensuring only authorized applications can interact with the system. Additionally, role-based access controls (RBAC) are implemented to manage user permissions for creating, reading, updating, and deleting entitlements.

Future Enhancements
--------------------

Planned improvements for Entitlement Ledger 2 include support for multiple currencies, bulk operations, and the ability to create custom entitlement types. Furthermore, we aim to improve performance and scalability by optimizing database queries and implementing caching strategies.
